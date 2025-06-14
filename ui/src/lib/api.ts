import { getAccessToken } from './auth.js';
import { API_BASE_URL } from './env.js';
import type { SearchResponse, ApiError, SearchParams } from './types.js';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getAccessToken();
    
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle API error responses
      const error = data as ApiError;
      throw new Error(error.message || error.error || 'An unexpected error occurred');
    }

    return data;
  }

  async searchImages(params: SearchParams): Promise<SearchResponse> {
    const searchParams = new URLSearchParams();
    
    searchParams.append('q', params.q);
    
    if (params.orientation) {
      searchParams.append('orientation', params.orientation);
    }
    
    if (params.count !== undefined) {
      searchParams.append('count', params.count.toString());
    }
    
    if (params.start !== undefined) {
      searchParams.append('start', params.start.toString());
    }

    if (params.engine) {
      searchParams.append('engine', params.engine);
    }

    const endpoint = `/api/search/images?${searchParams.toString()}`;
    return this.makeRequest<SearchResponse>(endpoint);
  }

  async getAvailableEngines(): Promise<{
    success: boolean;
    data: {
      engines: Array<{ name: string; key: string }>;
      defaultEngine: string;
      totalEngines: number;
    };
  }> {
    const endpoint = '/api/search/engines';
    return this.makeRequest(endpoint);
  }

  async getSearchHealth(engine?: string): Promise<{
    success: boolean;
    data: {
      healthy: boolean;
      engines: Array<{ key: string; name: string; healthy: boolean; message: string }>;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (engine) {
      searchParams.append('engine', engine);
    }
    
    const endpoint = `/api/search/health${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return this.makeRequest(endpoint);
  }

  async getCacheStats(): Promise<{
    success: boolean;
    data: {
      size: number;
      keys: string[];
    };
  }> {
    const endpoint = '/api/search/cache/stats';
    return this.makeRequest(endpoint);
  }

  async clearCache(pattern?: string): Promise<{
    success: boolean;
    data: {
      message: string;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (pattern) {
      searchParams.append('pattern', pattern);
    }
    
    const endpoint = `/api/search/cache${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return this.makeRequest(endpoint, { method: 'DELETE' });
  }

  // New method to clear the current user's D1 search cache
  async clearUserSearchCache(): Promise<{ success: boolean; message?: string; error?: string }> {
    const endpoint = '/api/search/cache/clear';
    // The backend endpoint is POST and doesn't require a body for this specific action
    // It uses the JWT to identify the user.
    return this.makeRequest<{ success: boolean; message?: string; error?: string }>(
      endpoint, 
      { method: 'POST' }
    );
  }

  // Method to fetch search suggestions
  async getSearchSuggestions(prefix: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
    if (!prefix || prefix.trim().length < 2) { // Typically, don't search for suggestions on very short prefixes
      return { success: true, data: [] };
    }
    const searchParams = new URLSearchParams({ q: prefix });
    const endpoint = `/api/search/suggestions?${searchParams.toString()}`;
    return this.makeRequest<{ success: boolean; data?: string[]; error?: string }>(
      endpoint, 
      { method: 'GET' } // Suggestions are fetched via GET
    );
  }
}

export const apiService = new ApiService(API_BASE_URL); 