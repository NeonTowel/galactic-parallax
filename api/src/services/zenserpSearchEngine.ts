import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  IntermediarySearchResult,
  IntermediaryPaginationInfo,
  ApiResponse 
} from '../types';
import { 
  craftWallpaperQuery, 
  isValidImageUrl, 
  getMimeTypeFromUrl, 
  getFileFormatFromUrl 
} from './queryUtils';
import { SEARCH_ENGINE_CONFIG } from '../config/searchEngines';

interface ZenserpImageResult {
  position: number;
  thumbnail: string;
  sourceUrl: string;
  title: string;
  link: string;
  source: string;
}

interface ZenserpSearchResponse {
  query: {
    q: string;
    tbm: string;
    num: string;
    apikey: string;
    url: string;
  };
  related_searches: any[];
  image_results: ZenserpImageResult[];
}

interface ZenserpCachedResults {
  allResults: IntermediarySearchResult[];
  totalResults: number;
  query: string;
  orientation?: 'landscape' | 'portrait';
  fetchedAt: string;
  searchTime: number;
}

export class ZenserpSearchEngine implements SearchEngine {
  name = 'Zenserp Images Search';
  supportsTbs = SEARCH_ENGINE_CONFIG.TBS_SUPPORT.ZENSERP;
  private apiKey: string;
  private baseUrl = 'https://app.zenserp.com/api/v2/search';
  
  private static rawResultsCache = new Map<string, ZenserpCachedResults>();
  private static readonly RAW_CACHE_TTL = 604800000; // 1 week in milliseconds

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private validateSearchRequest(request: SearchRequest): { isValid: boolean; error?: string } {
    if (!request.query || request.query.trim().length === 0) {
      return { isValid: false, error: 'Search query is required' };
    }

    if (request.query.length > 200) {
      return { isValid: false, error: 'Search query too long (max 200 characters)' };
    }

    if (request.count && (request.count < 1 || request.count > 100)) {
      return { isValid: false, error: 'Count must be between 1 and 100 for Zenserp engine' };
    }

    if (request.start && request.start < 1) {
      return { isValid: false, error: 'Start index must be greater than 0' };
    }

    if (request.orientation && !['landscape', 'portrait'].includes(request.orientation)) {
      return { isValid: false, error: 'Orientation must be either "landscape" or "portrait"' };
    }

    return { isValid: true };
  }

  private createRawResultsCacheKey(query: string, orientation?: 'landscape' | 'portrait'): string {
    return `zenserp_raw:${query.toLowerCase().trim()}:${orientation || 'any'}`;
  }

  private getCachedRawResults(cacheKey: string): ZenserpCachedResults | null {
    const cached = ZenserpSearchEngine.rawResultsCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const age = now - new Date(cached.fetchedAt).getTime();
    
    if (age > ZenserpSearchEngine.RAW_CACHE_TTL) {
      ZenserpSearchEngine.rawResultsCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  private setCachedRawResults(cacheKey: string, results: ZenserpCachedResults): void {
    ZenserpSearchEngine.rawResultsCache.set(cacheKey, results);
    
    if (ZenserpSearchEngine.rawResultsCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of ZenserpSearchEngine.rawResultsCache.entries()) {
        const age = now - new Date(value.fetchedAt).getTime();
        if (age > ZenserpSearchEngine.RAW_CACHE_TTL) {
          ZenserpSearchEngine.rawResultsCache.delete(key);
        }
      }
    }
  }

  private async fetchFromZenserpAPI(request: SearchRequest): Promise<ZenserpCachedResults> {
    const startTime = Date.now();
    
    const queryResult = craftWallpaperQuery(request.query, {
      orientation: request.orientation,
      includeQualityTerms: !this.supportsTbs, // Use manual terms only if TBS not supported
      includeOrientationTerms: !this.supportsTbs, // Use manual terms only if TBS not supported
      useTbsParameters: this.supportsTbs
    });

    const searchParams = new URLSearchParams({
      apikey: this.apiKey,
      q: queryResult.query,
      tbm: 'isch',
      num: '100' // Always fetch maximum for caching
    });

    // Add TBS parameters if supported and available
    const tbsParam = request.tbs || queryResult.tbs;
    if (this.supportsTbs && tbsParam) {
      searchParams.set('tbs', tbsParam);
    }

    const searchUrl = `${this.baseUrl}?${searchParams}`;

    // Debug logging
    console.log('🔍 [SEARCH DEBUG]', {
      engine: this.name,
      originalQuery: request.query,
      finalQuery: queryResult.query,
      tbsParameters: tbsParam || 'none',
      orientation: request.orientation || 'any',
      supportsTbs: this.supportsTbs,
      searchUrl: searchUrl.replace(this.apiKey, '[API_KEY_HIDDEN]'),
      timestamp: new Date().toISOString()
    });

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Galactic-Parallax-API/1.0'
      }
    });

    if (!response.ok) {
      console.error('❌ [SEARCH ERROR]', {
        engine: this.name,
        status: response.status,
        error: response.statusText
      });
      throw new Error(`Zenserp API error: ${response.status} ${response.statusText}`);
    }

    const data: ZenserpSearchResponse = await response.json();
    const searchTime = Date.now() - startTime;

    // Filter out results with invalid thumbnail URLs and apply orientation filtering
    const validResults = (data.image_results || []).filter(item => {
      // Skip results with invalid thumbnail URLs
      if (!isValidImageUrl(item.thumbnail)) return false;
      if (!isValidImageUrl(item.sourceUrl)) return false;
      
      return true;
    });

    // Convert to intermediary format
    const allResults: IntermediarySearchResult[] = validResults.map((item, index) => {
      // Extract dimensions from thumbnail URL if possible (Zenserp doesn't provide dimensions)
      // Default to reasonable estimates based on orientation
      const isLandscape = request.orientation !== 'portrait';
      const estimatedWidth = isLandscape ? 1920 : 1080;
      const estimatedHeight = isLandscape ? 1080 : 1920;

      return {
        id: `zenserp_${index + 1}`,
        title: item.title || 'Untitled',
        url: item.sourceUrl,
        thumbnailUrl: item.thumbnail,
        sourceUrl: item.link,
        sourceDomain: item.source || new URL(item.link).hostname,
        description: item.source || item.title || '',
        width: estimatedWidth,
        height: estimatedHeight,
        mimeType: getMimeTypeFromUrl(item.sourceUrl),
        fileFormat: getFileFormatFromUrl(item.sourceUrl)
      };
    });

    return {
      allResults,
      totalResults: allResults.length,
      query: request.query,
      orientation: request.orientation,
      fetchedAt: new Date().toISOString(),
      searchTime
    };
  }

  async search(request: SearchRequest): Promise<ApiResponse<IntermediarySearchResponse>> {
    try {
      const validation = this.validateSearchRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const rawCacheKey = this.createRawResultsCacheKey(request.query, request.orientation);
      let cachedResults = this.getCachedRawResults(rawCacheKey);

      if (!cachedResults) {
        cachedResults = await this.fetchFromZenserpAPI(request);
        this.setCachedRawResults(rawCacheKey, cachedResults);
      }

      const resultsPerPage = request.count || 10;
      const startIndex = request.start || 1;
      const currentPage = Math.ceil(startIndex / resultsPerPage);
      const totalResults = cachedResults.totalResults;
      const totalPages = Math.ceil(totalResults / resultsPerPage);

      // Paginate results
      const startIdx = startIndex - 1;
      const endIdx = startIdx + resultsPerPage;
      const paginatedResults = cachedResults.allResults.slice(startIdx, endIdx);

      const pagination: IntermediaryPaginationInfo = {
        currentPage,
        totalResults,
        resultsPerPage,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        nextStartIndex: currentPage < totalPages ? startIndex + resultsPerPage : undefined,
        previousStartIndex: currentPage > 1 ? Math.max(1, startIndex - resultsPerPage) : undefined
      };

      const response: IntermediarySearchResponse = {
        results: paginatedResults,
        pagination,
        searchInfo: {
          query: request.query,
          orientation: request.orientation,
          searchTime: cachedResults.searchTime / 1000,
          searchEngine: this.name,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ [SEARCH SUCCESS]', {
        engine: this.name,
        resultsFound: paginatedResults.length,
        totalResults: totalResults,
        searchTime: `${cachedResults.searchTime}ms`,
        cached: true
      });

      return {
        success: true,
        data: response,
        message: `Found ${paginatedResults.length} results out of ${totalResults} total results (cached: ${cachedResults.fetchedAt !== new Date().toISOString()})`
      };

    } catch (error) {
      console.error('💥 [SEARCH EXCEPTION]', {
        engine: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: `Zenserp search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const testParams = new URLSearchParams({
        apikey: this.apiKey,
        q: 'test wallpaper',
        tbm: 'isch',
        num: '1'
      });

      const response = await fetch(`${this.baseUrl}?${testParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      return {
        healthy: response.ok,
        message: response.ok ? 'Zenserp service is healthy' : `Zenserp API returned status ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Zenserp health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 