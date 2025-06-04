import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  IntermediarySearchResult, 
  IntermediaryPaginationInfo,
  GoogleSearchResponse,
  ApiResponse 
} from '../types';

export class GoogleSearchEngine implements SearchEngine {
  public readonly name = 'Google Custom Search';
  private apiKey: string;
  private searchEngineId: string;
  private baseUrl = 'https://customsearch.googleapis.com/customsearch/v1';

  constructor(apiKey: string, searchEngineId: string) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  /**
   * Crafts a search query optimized for high-quality wallpapers
   */
  private craftSearchQuery(userQuery: string, orientation?: 'landscape' | 'portrait'): string {
    const qualityTerms = ['wallpaper', '2K OR UHD OR 4K OR "ultra hd"'];
    const orientationTerms = orientation === 'portrait' ? ['mobile'] : ['widescreen'];
    
    return [userQuery, ...qualityTerms, ...orientationTerms].join(' ');
  }

  /**
   * Builds the complete search URL with all parameters
   */
  private buildSearchUrl(params: {
    query: string;
    orientation?: 'landscape' | 'portrait';
    count?: number;
    start?: number;
  }): string {
    const craftedQuery = this.craftSearchQuery(params.query, params.orientation);
    
    const url = new URL(this.baseUrl);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('cx', this.searchEngineId);
    url.searchParams.set('q', craftedQuery);
    url.searchParams.set('searchType', 'image');
    url.searchParams.set('num', String(params.count || 10));
    url.searchParams.set('start', String(params.start || 1));
    url.searchParams.set('safe', 'off');
    url.searchParams.set('imgSize', 'huge');
    url.searchParams.set('imgType', 'photo');
    url.searchParams.set('fileType', 'jpg,png');
    url.searchParams.set('filter', '1');
    url.searchParams.set('imgColorType', 'color');

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
   * Converts Google Search API response to intermediary format
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

    // Convert Google results to intermediary format
    const results: IntermediarySearchResult[] = (googleResponse.items || []).map((item, index) => ({
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
    }));

    // Calculate pagination info
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
   * Performs the search and returns intermediary format
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

      // Build search URL
      const searchUrl = this.buildSearchUrl(request);

      // Make API request
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Galactic-Parallax-API/1.0'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Google API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        };
      }

      const googleResponse: GoogleSearchResponse = await response.json();
      const searchTime = (Date.now() - startTime) / 1000;

      // Convert to intermediary format
      const intermediaryResponse = this.convertToIntermediaryFormat(googleResponse, request, searchTime);

      return {
        success: true,
        data: intermediaryResponse,
        message: `Found ${intermediaryResponse.results.length} results out of ${intermediaryResponse.pagination.totalResults} total results`
      };

    } catch (error) {
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