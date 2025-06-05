import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  IntermediarySearchResult, 
  IntermediaryPaginationInfo,
  ApiResponse 
} from '../types';
import { SEARCH_ENGINE_CONFIG } from '../config/searchEngines';

export class MockSearchEngine implements SearchEngine {
  public readonly name = 'Mock Search Engine';
  public readonly supportsTbs = SEARCH_ENGINE_CONFIG.TBS_SUPPORT.MOCK;

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
   * Generates mock search results
   */
  private generateMockResults(
    request: SearchRequest,
    startIndex: number,
    count: number
  ): IntermediarySearchResult[] {
    const results: IntermediarySearchResult[] = [];
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      const isLandscape = request.orientation !== 'portrait';
      
      results.push({
        id: `mock_${index}`,
        title: `Mock ${request.query} Wallpaper #${index}`,
        url: `https://picsum.photos/${isLandscape ? '1920/1080' : '1080/1920'}?random=${index}`,
        thumbnailUrl: `https://picsum.photos/${isLandscape ? '320/180' : '180/320'}?random=${index}`,
        sourceUrl: `https://example.com/wallpaper/${index}`,
        sourceDomain: 'example.com',
        description: `A beautiful ${request.query} wallpaper generated for testing purposes`,
        width: isLandscape ? 1920 : 1080,
        height: isLandscape ? 1080 : 1920,
        fileSize: Math.floor(Math.random() * 5000000) + 1000000, // 1-6MB
        mimeType: 'image/jpeg',
        fileFormat: 'JPEG'
      });
    }

    return results;
  }

  /**
   * Simulates pagination for search engines that don't support it natively
   */
  private simulatePagination(
    request: SearchRequest,
    totalMockResults: number = 1000
  ): { results: IntermediarySearchResult[]; pagination: IntermediaryPaginationInfo } {
    const resultsPerPage = request.count || 10;
    const currentStartIndex = request.start || 1;
    const currentPage = Math.ceil(currentStartIndex / resultsPerPage);
    const totalPages = Math.ceil(totalMockResults / resultsPerPage);

    // Generate results for current page
    const results = this.generateMockResults(request, currentStartIndex, resultsPerPage);

    // Calculate pagination info
    const pagination: IntermediaryPaginationInfo = {
      currentPage,
      totalResults: totalMockResults,
      resultsPerPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      nextStartIndex: currentPage < totalPages ? currentStartIndex + resultsPerPage : undefined,
      previousStartIndex: currentPage > 1 ? Math.max(1, currentStartIndex - resultsPerPage) : undefined
    };

    return { results, pagination };
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

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

      // Generate mock results with pagination
      const { results, pagination } = this.simulatePagination(request);
      const searchTime = (Date.now() - startTime) / 1000;

      const intermediaryResponse: IntermediarySearchResponse = {
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

      return {
        success: true,
        data: intermediaryResponse,
        message: `Found ${results.length} mock results out of ${pagination.totalResults} total results`
      };

    } catch (error) {
      return {
        success: false,
        error: 'Mock search service error'
      };
    }
  }

  /**
   * Health check for the mock search service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    // Mock search engine is always healthy
    return {
      healthy: true,
      message: 'Mock search service is healthy and ready for testing'
    };
  }
} 