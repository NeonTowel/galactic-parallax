export interface Bindings {
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  JWT_SECRET?: string;
  GOOGLE_SEARCH_API_KEY: string;
  GOOGLE_SEARCH_ENGINE_ID: string;
}

export interface JWTPayload {
  sub: string;
  permissions?: string[];
  [key: string]: any;
}

export interface SearchRequest {
  query: string;
  orientation?: 'landscape' | 'portrait';
  count?: number;
  start?: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  searchInformation: {
    totalResults: string;
    searchTime: number;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
    }>;
    nextPage?: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
    }>;
  };
}

export interface SearchResultItem {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
  htmlSnippet: string;
  mime: string;
  fileFormat: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 