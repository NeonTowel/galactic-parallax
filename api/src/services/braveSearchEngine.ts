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

export class BraveSearchEngine implements SearchEngine {
  public readonly name = 'Brave Search';
  public readonly supportsTbs = SEARCH_ENGINE_CONFIG.TBS_SUPPORT.BRAVE;
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/images/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Builds search URL using Brave's native parameters and operators for optimal results
   */
  private buildSearchUrl(params: {
    query: string;
    orientation?: 'landscape' | 'portrait';
    count?: number;
    start?: number;
    country?: string;
    safesearch?: 'off' | 'strict';
    search_lang?: string;
  }): string {
    
    // Craft optimized query using Brave search operators
    const optimizedQuery = craftBraveWallpaperQuery(params.query, {
      orientation: params.orientation,
      engine: 'brave'
    });
    
    const url = new URL(this.baseUrl);
    
    // Required parameter
    url.searchParams.set('q', optimizedQuery);
    
    // Optional parameters with proper defaults per Brave Image Search API
    url.searchParams.set('count', String(Math.min(params.count || 50, 100))); // Default 50, max 100
    url.searchParams.set('safesearch', params.safesearch || 'off'); // Default to strict for wallpapers
    url.searchParams.set('spellcheck', 'false'); // Disable spellcheck (boolean as string)

    // Add pagination support using offset parameter
    if (params.start && params.start > 1) {
      const resultsPerPage = params.count || 50;
      const offset = Math.floor((params.start - 1) / resultsPerPage);
      url.searchParams.set('offset', String(Math.min(offset, 9))); // Max offset is 9 per Brave API docs
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

    if (request.query.length > 400) {
      return { isValid: false, error: 'Search query too long (max 400 characters)' };
    }

    if (request.count && (request.count < 1 || request.count > 100)) {
      return { isValid: false, error: 'Count must be between 1 and 100' };
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
   * Convert Brave Image Search response to intermediary format
   * Note: Brave Image Search API supports pagination via offset parameter
   */
  private convertToIntermediaryFormat(
    braveResponse: BraveSearchResponse, 
    request: SearchRequest,
    searchTime: number
  ): IntermediarySearchResponse {
    const resultsPerPage = request.count || 50;
    const currentStartIndex = request.start || 1;
    const currentPage = Math.ceil(currentStartIndex / resultsPerPage);

    // Extract image results from Brave response (direct results array)
    const imageResults = braveResponse.results || [];
    
    // Convert Brave image results to intermediary format
    const results: IntermediarySearchResult[] = imageResults
      .filter((item: BraveImageResult) => {
        // Primary filter: main image URL must be valid (this is what users will download)
        const hasValidImageUrl = isValidImageUrl(item.properties.url);
        
        // Secondary filter: thumbnail should exist (but can be Brave proxy without extension)
        const hasValidThumbnail = item.thumbnail?.src && item.thumbnail.src.length > 0;
        
        return hasValidImageUrl && hasValidThumbnail;
      })
      .map((item: BraveImageResult, index: number) => {
        // Log quality metrics for monitoring
        debugLog('LOG_RESPONSES', '📊 [BRAVE RESULT QUALITY]', {
          index: index + 1,
          source: item.source,
          confidence: item.confidence,
          url: item.properties.url
        });

        return {
          id: `brave_${currentStartIndex + index}`,
          title: item.title || 'Untitled',
          url: item.properties.url,
          thumbnailUrl: item.thumbnail.src,
          sourceUrl: item.url,
          sourceDomain: item.source,
          description: item.title || '',
          width: 0, // Brave doesn't provide dimensions
          height: 0, // Brave doesn't provide dimensions
          fileSize: undefined, // Brave doesn't provide file size
          mimeType: getMimeTypeFromUrl(item.properties.url),
          fileFormat: getFileFormatFromUrl(item.properties.url)
        };
      });

    // Calculate pagination based on Brave API limitations
    // Brave supports up to 10 pages (offset 0-9) with max 100 results per page
    const maxOffset = 9;
    const maxResultsPerOffset = 100;
    // Estimate total results: if we got a full page, assume there might be more
    const estimatedTotalResults = results.length === resultsPerPage 
      ? Math.min(resultsPerPage * (maxOffset + 1), 1000) // Assume max possible if full page
      : currentStartIndex + results.length - 1; // Exact count if partial page
    const totalPages = Math.min(Math.ceil(estimatedTotalResults / resultsPerPage), maxOffset + 1);
    
    // Determine if there are more pages available
    const currentOffset = Math.floor((currentStartIndex - 1) / resultsPerPage);
    const hasNextPage = currentOffset < maxOffset && results.length === resultsPerPage;
    const hasPreviousPage = currentPage > 1;

    const pagination: IntermediaryPaginationInfo = {
      currentPage,
      totalResults: estimatedTotalResults,
      resultsPerPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      nextStartIndex: hasNextPage ? currentStartIndex + resultsPerPage : undefined,
      previousStartIndex: hasPreviousPage ? Math.max(1, currentStartIndex - resultsPerPage) : undefined
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
   * Single optimized search using Brave Search API
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
        start: request.start
      });

      debugLog('LOG_QUERY_BUILDING', '🔍 [BRAVE SEARCH]', {
        engine: this.name,
        originalQuery: request.query,
        searchUrl: SEARCH_ENGINE_CONFIG.DEBUG.HIDE_API_KEYS 
          ? searchUrl.replace(this.apiKey, '[API_KEY_HIDDEN]')
          : searchUrl,
        strategy: 'brave_operators_optimization'
      });

      // Single API call to Brave Search
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
          error: errorData.message || 'Unknown error'
        });
        return {
          success: false,
          error: `Brave Search API error: ${response.status} - ${errorData.message || 'Unknown error'}`
        };
      }

      const braveResponse: BraveSearchResponse = await response.json();
      const searchTime = (Date.now() - startTime) / 1000;

      // Convert to intermediary format
      const intermediaryResponse = this.convertToIntermediaryFormat(braveResponse, request, searchTime);

      debugLog('LOG_API_CALLS', '✅ [BRAVE SEARCH SUCCESS]', {
        engine: this.name,
        resultsFound: intermediaryResponse.results.length,
        totalResults: intermediaryResponse.pagination.totalResults,
        searchTime: `${searchTime}s`,
        strategy: 'brave_image_search'
      });

      return {
        success: true,
        data: intermediaryResponse,
        message: `Found ${intermediaryResponse.results.length} results using Brave Search`
      };

    } catch (error) {
      debugLog('LOG_API_CALLS', '💥 [BRAVE SEARCH EXCEPTION]', {
        engine: this.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: 'Internal Brave Search service error'
      };
    }
  }

  /**
   * Health check for the Brave Search service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const testUrl = this.buildSearchUrl({ 
        query: 'test wallpaper', 
        count: 1 
      });

      const response = await fetch(testUrl, {
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