import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  IntermediarySearchResult,
  IntermediaryPaginationInfo,
  ApiResponse 
} from '../types';

interface SerperImageResult {
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  source: string;
  domain: string;
  link: string;
  position: number;
}

interface SerperSearchResponse {
  searchParameters: {
    q: string;
    type: string;
    autocorrect: boolean;
    engine: string;
    num: number;
  };
  images: SerperImageResult[];
  credits: number;
}

// Interface for caching raw Serper results
interface SerperCachedResults {
  allResults: IntermediarySearchResult[];
  totalResults: number;
  query: string;
  orientation?: 'landscape' | 'portrait';
  fetchedAt: string;
  searchTime: number;
}

export class SerperSearchEngine implements SearchEngine {
  name = 'Serper Images Search';
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev/images';
  
  // Simple in-memory cache for raw results (separate from main cache)
  private static rawResultsCache = new Map<string, SerperCachedResults>();
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

    if (request.query.length > 200) {
      return { isValid: false, error: 'Search query too long (max 200 characters)' };
    }

    if (request.count && (request.count < 1 || request.count > 100)) {
      return { isValid: false, error: 'Count must be between 1 and 100 for Serper engine' };
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
    return `serper_raw:${query.toLowerCase().trim()}:${orientation || 'any'}`;
  }

  /**
   * Gets cached raw results if available and not expired
   */
  private getCachedRawResults(cacheKey: string): SerperCachedResults | null {
    const cached = SerperSearchEngine.rawResultsCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const age = now - new Date(cached.fetchedAt).getTime();
    
    if (age > SerperSearchEngine.RAW_CACHE_TTL) {
      SerperSearchEngine.rawResultsCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Caches raw results
   */
  private setCachedRawResults(cacheKey: string, results: SerperCachedResults): void {
    SerperSearchEngine.rawResultsCache.set(cacheKey, results);
    
    // Simple cleanup if cache gets too large
    if (SerperSearchEngine.rawResultsCache.size > 50) {
      const now = Date.now();
      for (const [key, value] of SerperSearchEngine.rawResultsCache.entries()) {
        const age = now - new Date(value.fetchedAt).getTime();
        if (age > SerperSearchEngine.RAW_CACHE_TTL) {
          SerperSearchEngine.rawResultsCache.delete(key);
        }
      }
    }
  }

  /**
   * Fetches fresh results from Serper API
   */
  private async fetchFromSerperAPI(request: SearchRequest): Promise<SerperCachedResults> {
    const startTime = Date.now();
    
    const searchParams = new URLSearchParams({
      q: request.query,
      num: '100', // Always fetch maximum for caching
      autocorrect: 'false',
      apiKey: this.apiKey
    });

    const response = await fetch(`${this.baseUrl}?${searchParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data: SerperSearchResponse = await response.json();
    const searchTime = Date.now() - startTime;

    // Apply orientation filtering
    const filteredResults = (data.images || []).filter(item => {
      if (!request.orientation) return true;
      const isLandscape = item.imageWidth > item.imageHeight;
      return request.orientation === 'landscape' ? isLandscape : !isLandscape;
    });

    // Convert to intermediary format
    const allResults: IntermediarySearchResult[] = filteredResults.map((item, index) => ({
      id: `serper_${index + 1}`,
      title: item.title || 'Untitled',
      url: item.imageUrl,
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.link,
      sourceDomain: item.domain,
      description: item.source || item.domain,
      width: item.imageWidth,
      height: item.imageHeight,
      mimeType: this.getMimeTypeFromUrl(item.imageUrl),
      fileFormat: this.getFileFormatFromUrl(item.imageUrl)
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
        cachedResults = await this.fetchFromSerperAPI(request);
        this.setCachedRawResults(rawCacheKey, cachedResults);
      }

      // Handle empty results
      if (cachedResults.totalResults === 0) {
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
        id: `serper_${startIndex + index}`
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
      return {
        success: false,
        error: `Serper search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const testResponse = await fetch(`${this.baseUrl}?q=test&num=1&apiKey=${this.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (testResponse.ok) {
        return {
          healthy: true,
          message: 'Serper Images Search API is accessible'
        };
      } else {
        return {
          healthy: false,
          message: `Serper API returned status ${testResponse.status}`
        };
      }
    } catch (error) {
      return {
        healthy: false,
        message: `Serper API health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private getMimeTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp'
    };
    return mimeTypes[extension || ''] || 'image/jpeg';
  }

  private getFileFormatFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    return extension?.toUpperCase() || 'JPEG';
  }
} 