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

    const endpoint = `/api/search/images?${searchParams.toString()}`;
    return this.makeRequest<SearchResponse>(endpoint);
  }
}

export const apiService = new ApiService(API_BASE_URL); 