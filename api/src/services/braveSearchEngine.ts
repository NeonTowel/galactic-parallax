import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  IntermediarySearchResult, 
  IntermediaryPaginationInfo,
  BraveSearchResponse,
  BraveImageResult,
  ApiResponse 
} from '../types';
import { debugLog, isValidImageUrl, getMimeTypeFromUrl, getFileFormatFromUrl, craftBraveWallpaperQuery } from './queryUtils';
import { SEARCH_ENGINE_CONFIG } from '../config/searchEngines';

// Interface for caching raw Brave results
interface BraveCachedResults {
  allResults: IntermediarySearchResult[];
  totalResults: number;
  query: string;
  orientation?: 'landscape' | 'portrait';
  fetchedAt: string;
  searchTime: number;
}

export class BraveSearchEngine implements SearchEngine {
  public readonly name = 'Brave Search';
  public readonly supportsTbs = SEARCH_ENGINE_CONFIG.TBS_SUPPORT.BRAVE;
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/images/search';
  
  // Simple in-memory cache for raw results (separate from main cache)
  private static rawResultsCache = new Map<string, BraveCachedResults>();
  private static readonly RAW_CACHE_TTL = 604800000; // 1 week in milliseconds

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Validates search request parameters
   */
  private validateSearchRequest(request: SearchRequest): { isValid: boolean; error?: string } {
    if (!request.query || request.query.trim().length === 0) {
      return { isValid: false, error: 'Search query is required' };
    }

    if (request.query.length > 400) {
      return { isValid: false, error: 'Search query too long (max 400 characters)' };
    }

    if (request.count && (request.count < 1 || request.count > 100)) {
      return { isValid: false, error: 'Count must be between 1 and 100 for Brave engine' };
    }

    if (request.start && request.start < 1) {
      return { isValid: false, error: 'Start index must be greater than 0' };
    }

    if (request.orientation && !['landscape', 'portrait'].includes(request.orientation)) {
      return { isValid: false, error: 'Orientation must be either "landscape" or "portrait"' };
    }

    return { isValid: true };
  }

  /**
   * Creates a cache key for raw results (query + orientation only)
   */
  private createRawResultsCacheKey(query: string, orientation?: 'landscape' | 'portrait'): string {
    return `brave_raw:${query.toLowerCase().trim()}:${orientation || 'any'}`;
  }

  /**
   * Gets cached raw results if available and not expired
   */
  private getCachedRawResults(cacheKey: string): BraveCachedResults | null {
    const cached = BraveSearchEngine.rawResultsCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const age = now - new Date(cached.fetchedAt).getTime();
    
    if (age > BraveSearchEngine.RAW_CACHE_TTL) {
      BraveSearchEngine.rawResultsCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Caches raw results
   */
  private setCachedRawResults(cacheKey: string, results: BraveCachedResults): void {
    BraveSearchEngine.rawResultsCache.set(cacheKey, results);
    
    // Simple cleanup if cache gets too large
    if (BraveSearchEngine.rawResultsCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of BraveSearchEngine.rawResultsCache.entries()) {
        const age = now - new Date(value.fetchedAt).getTime();
        if (age > BraveSearchEngine.RAW_CACHE_TTL) {
          BraveSearchEngine.rawResultsCache.delete(key);
        }
      }
    }
  }

  /**
   * Fetches fresh results from Brave API
   */
  private async fetchFromBraveAPI(request: SearchRequest): Promise<BraveCachedResults> {
    const startTime = Date.now();
    
    // Craft optimized query using Brave search operators
    const optimizedQuery = craftBraveWallpaperQuery(request.query, {
      orientation: request.orientation,
      engine: 'brave'
    });
    
    const url = new URL(this.baseUrl);
    url.searchParams.set('q', optimizedQuery);
    url.searchParams.set('count', '100'); // Always fetch maximum for caching
    url.searchParams.set('safesearch', 'off');
    url.searchParams.set('spellcheck', 'false');

    const searchUrl = url.toString();

    // Debug logging
    debugLog('LOG_QUERY_BUILDING', '🔍 [BRAVE SEARCH DEBUG]', {
      engine: this.name,
      originalQuery: request.query,
      finalQuery: optimizedQuery,
      orientation: request.orientation || 'any',
      supportsTbs: this.supportsTbs,
      searchUrl: SEARCH_ENGINE_CONFIG.DEBUG.HIDE_API_KEYS 
        ? searchUrl.replace(this.apiKey, '[API_KEY_HIDDEN]')
        : searchUrl,
      timestamp: new Date().toISOString()
    });

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
        'User-Agent': 'Galactic-Parallax-API/1.0'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugLog('LOG_API_CALLS', '❌ [BRAVE SEARCH ERROR]', {
        engine: this.name,
        status: response.status,
        error: errorData.message || response.statusText
      });
      throw new Error(`Brave API error: ${response.status} ${errorData.message || response.statusText}`);
    }

    const braveResponse: BraveSearchResponse = await response.json();
    const searchTime = Date.now() - startTime;

    // Extract and filter image results
    const imageResults = braveResponse.results || [];
    const filteredResults = imageResults.filter((item: BraveImageResult) => {
      // Skip results with invalid URLs
      if (!isValidImageUrl(item.properties.url)) return false;
      if (!item.thumbnail?.src || item.thumbnail.src.length === 0) return false;
      
      if (!request.orientation) return true;
      // Note: Brave doesn't provide dimensions, so we can't filter by orientation here
      // The orientation filtering is handled by the query optimization
      return true;
    });

    // Convert to intermediary format
    const allResults: IntermediarySearchResult[] = filteredResults.map((item: BraveImageResult, index: number) => ({
      id: `brave_${index + 1}`,
      title: item.title || 'Untitled',
      url: item.properties.url,
      thumbnailUrl: item.thumbnail.src,
      sourceUrl: item.url,
      sourceDomain: item.source,
      description: item.title || '',
      width: 0, // Brave API v1 for images doesn't provide dimensions directly in the main results list
      height: 0, // ditto
      fileSize: undefined, // Brave API v1 for images doesn't provide file size
      mimeType: getMimeTypeFromUrl(item.properties.url),
      fileFormat: getFileFormatFromUrl(item.properties.url),
      sourceEngine: 'brave'
    }));

    return {
      allResults,
      totalResults: allResults.length,
      query: request.query,
      orientation: request.orientation,
      fetchedAt: new Date().toISOString(),
      searchTime
    };
  }

  /**
   * Single optimized search using Brave Search API with caching
   */
  async search(request: SearchRequest): Promise<ApiResponse<IntermediarySearchResponse>> {
    try {
      // Validate request
      const validation = this.validateSearchRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Check for cached raw results first
      const rawCacheKey = this.createRawResultsCacheKey(request.query, request.orientation);
      let cachedResults = this.getCachedRawResults(rawCacheKey);
      
      // Fetch fresh results if not cached
      if (!cachedResults) {
        cachedResults = await this.fetchFromBraveAPI(request);
        this.setCachedRawResults(rawCacheKey, cachedResults);
      }

      // Handle empty results
      if (cachedResults.totalResults === 0) {
        debugLog('LOG_API_CALLS', '⚠️ [BRAVE SEARCH WARNING]', {
          engine: this.name,
          message: 'No results found',
          query: request.query
        });
        return {
          success: true,
          data: {
            results: [],
            pagination: {
              currentPage: 1,
              totalResults: 0,
              resultsPerPage: request.count || 10,
              totalPages: 0,
              hasNextPage: false,
              hasPreviousPage: false
            },
            searchInfo: {
              query: request.query,
              orientation: request.orientation,
              searchTime: cachedResults.searchTime,
              searchEngine: this.name,
              timestamp: new Date().toISOString()
            }
          }
        };
      }

      // Generate paginated response from cached results
      const requestedCount = request.count || 10;
      const startIndex = request.start || 1;
      const currentPage = Math.ceil(startIndex / requestedCount);
      const totalPages = Math.ceil(cachedResults.totalResults / requestedCount);

      // Slice results for the current page
      const startSliceIndex = startIndex - 1;
      const endSliceIndex = startSliceIndex + requestedCount;
      const pageResults = cachedResults.allResults.slice(startSliceIndex, endSliceIndex);

      // Update IDs to reflect actual position in pagination
      const results: IntermediarySearchResult[] = pageResults.map((item, index) => ({
        ...item,
        id: `brave_${startIndex + index}`
      }));

      const pagination: IntermediaryPaginationInfo = {
        currentPage,
        totalResults: cachedResults.totalResults,
        resultsPerPage: requestedCount,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        nextStartIndex: currentPage < totalPages ? startIndex + requestedCount : undefined,
        previousStartIndex: currentPage > 1 ? Math.max(1, startIndex - requestedCount) : undefined
      };

      debugLog('LOG_API_CALLS', '✅ [BRAVE SEARCH SUCCESS]', {
        engine: this.name,
        resultsFound: results.length,
        totalResults: cachedResults.totalResults,
        searchTime: `${cachedResults.searchTime}ms`,
        cached: true
      });

      return {
        success: true,
        data: {
          results,
          pagination,
          searchInfo: {
            query: request.query,
            orientation: request.orientation,
            searchTime: cachedResults.searchTime,
            searchEngine: this.name,
            timestamp: new Date().toISOString()
          }
        }
      };

    } catch (error) {
      debugLog('LOG_API_CALLS', '💥 [BRAVE SEARCH EXCEPTION]', {
        engine: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: `Brave search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Health check for the Brave Search service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('q', 'test wallpaper');
      url.searchParams.set('count', '1');
      url.searchParams.set('safesearch', 'off');
      url.searchParams.set('spellcheck', 'false');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey
        }
      });

      return {
        healthy: response.ok,
        message: response.ok ? 'Brave Search service is healthy' : `Brave Search API returned status ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Brave Search service health check failed'
      };
    }
  }
} 