import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  IntermediarySearchResult, 
  IntermediaryPaginationInfo,
  GoogleSearchResponse,
  ApiResponse 
} from '../types';
import { craftMinimalWallpaperQuery, debugLog } from './queryUtils';
import { SEARCH_ENGINE_CONFIG } from '../config/searchEngines';

export class GoogleSearchEngine implements SearchEngine {
  public readonly name = 'Google Custom Search';
  public readonly supportsTbs = SEARCH_ENGINE_CONFIG.TBS_SUPPORT.GOOGLE;
  private apiKey: string;
  private searchEngineId: string;
  private baseUrl = 'https://customsearch.googleapis.com/customsearch/v1';

  constructor(apiKey: string, searchEngineId: string) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  /**
   * Builds search URL using Google's native parameters for optimal results
   */
  private buildSearchUrl(params: {
    query: string;
    orientation?: 'landscape' | 'portrait';
    count?: number;
    start?: number;
    tbs?: string;
  }): string {
    
    // Use the optimized minimal query approach
    const queryResult = craftMinimalWallpaperQuery(params.query, {
      orientation: params.orientation,
      useTbsParameters: true
    });
    
    const url = new URL(this.baseUrl);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('cx', this.searchEngineId);
    url.searchParams.set('q', queryResult.query);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', String(params.count || 10));
    url.searchParams.set('start', String(params.start || 1));
    url.searchParams.set('safe', 'off');
    url.searchParams.set('filter', '1');
    
    // Add Google's native parameters for precise control
    if (queryResult.orTerms) {
      url.searchParams.set('orTerms', queryResult.orTerms);
    }
    
    if (queryResult.excludeTerms) {
      url.searchParams.set('excludeTerms', queryResult.excludeTerms);
    }
    
    // Use custom TBS if provided, otherwise use optimized TBS
    const finalTbs = params.tbs || queryResult.tbs;
    if (finalTbs) {
      url.searchParams.set('tbs', finalTbs);
    }

    return url.toString();
  }

  /**
   * Validates search request parameters
   */
  private validateSearchRequest(request: SearchRequest): { isValid: boolean; error?: string } {
    if (!request.query || request.query.trim().length === 0) {
      return { isValid: false, error: 'Search query is required' };
    }

    if (request.query.length > 200) {
      return { isValid: false, error: 'Search query too long (max 200 characters)' };
    }

    if (request.count && (request.count < 1 || request.count > 10)) {
      return { isValid: false, error: 'Count must be between 1 and 10' };
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
   * Convert Google response to intermediary format
   */
  private convertToIntermediaryFormat(
    googleResponse: GoogleSearchResponse, 
    request: SearchRequest,
    searchTime: number
  ): IntermediarySearchResponse {
    const resultsPerPage = request.count || 10;
    const currentStartIndex = request.start || 1;
    const currentPage = Math.ceil(currentStartIndex / resultsPerPage);
    const totalResults = parseInt(googleResponse.searchInformation.totalResults) || 0;
    const totalPages = Math.ceil(totalResults / resultsPerPage);

    // Convert all results - trust Google's filtering
    const results: IntermediarySearchResult[] = (googleResponse.items || []).map((item, index) => {
      // Log quality metrics for monitoring
      debugLog('LOG_RESPONSES', '📊 [RESULT QUALITY]', {
        index: index + 1,
        dimensions: `${item.image.width}x${item.image.height}`,
        fileSize: item.image.byteSize ? `${Math.round(item.image.byteSize/1024)}KB` : 'unknown',
        isDirect: !item.link.includes('encrypted-tbn') && !item.link.includes('gstatic.com'),
        url: item.link
      });

      return {
        id: `google_${currentStartIndex + index}`,
        title: item.title,
        url: item.link,
        thumbnailUrl: item.image.thumbnailLink,
        sourceUrl: item.image.contextLink,
        sourceDomain: item.displayLink,
        description: item.snippet,
        width: item.image.width,
        height: item.image.height,
        fileSize: item.image.byteSize,
        mimeType: item.mime,
        fileFormat: item.fileFormat
      };
    });

    const pagination: IntermediaryPaginationInfo = {
      currentPage,
      totalResults,
      resultsPerPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      nextStartIndex: currentPage < totalPages ? currentStartIndex + resultsPerPage : undefined,
      previousStartIndex: currentPage > 1 ? Math.max(1, currentStartIndex - resultsPerPage) : undefined
    };

    return {
      results,
      pagination,
      searchInfo: {
        query: request.query,
        orientation: request.orientation,
        searchTime,
        searchEngine: this.name,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Single optimized search - no fallback complexity
   */
  async search(request: SearchRequest): Promise<ApiResponse<IntermediarySearchResponse>> {
    const startTime = Date.now();

    try {
      // Validate request
      const validation = this.validateSearchRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Build optimized search URL
      const searchUrl = this.buildSearchUrl({
        query: request.query,
        orientation: request.orientation,
        count: request.count,
        start: request.start,
        tbs: request.tbs
      });

      debugLog('LOG_QUERY_BUILDING', '🔍 [GOOGLE SEARCH]', {
        engine: this.name,
        originalQuery: request.query,
        searchUrl: SEARCH_ENGINE_CONFIG.DEBUG.HIDE_API_KEYS 
          ? searchUrl.replace(this.apiKey, '[API_KEY_HIDDEN]')
          : searchUrl,
        strategy: 'single_optimized_call'
      });

      // Single API call to Google
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Galactic-Parallax-API/1.0'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        debugLog('LOG_API_CALLS', '❌ [SEARCH ERROR]', {
          engine: this.name,
          status: response.status,
          error: errorData.error?.message || 'Unknown error'
        });
        return {
          success: false,
          error: `Google API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const googleResponse: GoogleSearchResponse = await response.json();
      const searchTime = (Date.now() - startTime) / 1000;

      // Convert to intermediary format
      const intermediaryResponse = this.convertToIntermediaryFormat(googleResponse, request, searchTime);

      debugLog('LOG_API_CALLS', '✅ [SEARCH SUCCESS]', {
        engine: this.name,
        resultsFound: intermediaryResponse.results.length,
        totalResults: intermediaryResponse.pagination.totalResults,
        searchTime: `${searchTime}s`,
        strategy: 'single_call'
      });

      return {
        success: true,
        data: intermediaryResponse,
        message: `Found ${intermediaryResponse.results.length} results out of ${intermediaryResponse.pagination.totalResults} total results`
      };

    } catch (error) {
      debugLog('LOG_API_CALLS', '💥 [SEARCH EXCEPTION]', {
        engine: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: 'Internal search service error'
      };
    }
  }

  /**
   * Health check for the Google Search service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const testUrl = this.buildSearchUrl({ 
        query: 'test', 
        count: 1 
      });

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      return {
        healthy: response.ok,
        message: response.ok ? 'Google Search service is healthy' : `Google API returned status ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Google Search service health check failed'
      };
    }
  }
} 