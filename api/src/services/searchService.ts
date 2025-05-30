import { SearchRequest, SearchResponse, ApiResponse } from '../types';

export class SearchService {
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
    // Base terms for high-quality wallpapers
    const qualityTerms = ['wallpaper', '2K OR UHD OR 4K OR "ultra hd"'];
    
    // Orientation-specific terms
    const orientationTerms = orientation === 'portrait' 
      ? ['mobile'] 
      : ['widescreen'];

    // Combine user query with quality and orientation terms
    const searchTerms = [
      userQuery,
      ...qualityTerms,
      ...orientationTerms
    ].join(' ');

    return searchTerms;
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
    url.searchParams.set('safe', 'off'); // Disable safe search as requested
    url.searchParams.set('imgSize', 'huge'); // Prefer larger images
    url.searchParams.set('imgType', 'photo'); // Focus on photographic content
    url.searchParams.set('fileType', 'jpg,png'); // High-quality formats
    url.searchParams.set('filter', '1'); // Turn on duplicate content filter
    url.searchParams.set('imgColorType', 'color'); // Search for color images

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
   * Filters and enhances search results for better quality
   */
  private filterResults(response: SearchResponse): SearchResponse {
    if (!response.items) {
      return response;
    }

    // Filter out low-quality images
    const filteredItems = response.items.filter(item => {
      const { image } = item;
      
      // Minimum resolution requirements for 2K quality
      const minWidth = 1920;
      const minHeight = 1080;
      
      return (image.width >= minWidth || image.height >= minWidth) && 
             (image.width >= minHeight || image.height >= minHeight);
    });

    // Sort by image size (larger images first)
    filteredItems.sort((a, b) => {
      const aSize = a.image.width * a.image.height;
      const bSize = b.image.width * b.image.height;
      return bSize - aSize;
    });

    return {
      ...response,
      items: filteredItems
    };
  }

  /**
   * Performs the search with error handling and result filtering
   */
  async search(request: SearchRequest): Promise<ApiResponse<SearchResponse>> {
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

      const searchResponse: SearchResponse = await response.json();

      // Filter and enhance results
      const filteredResponse = this.filterResults(searchResponse);

      return {
        success: true,
        //data: filteredResponse,
        data: searchResponse,
        message: `Found ${filteredResponse.items?.length || 0} high-quality results out of ${searchResponse.searchInformation?.totalResults || 0} total results`
      };

    } catch (error) {
      return {
        success: false,
        error: 'Internal search service error'
      };
    }
  }

  /**
   * Health check for the search service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Test with a simple query
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
        message: response.ok ? 'Search service is healthy' : `API returned status ${response.status}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Search service health check failed'
      };
    }
  }
} 