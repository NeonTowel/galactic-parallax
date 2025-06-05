export interface Bindings {
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  JWT_SECRET?: string;
  GOOGLE_SEARCH_API_KEY: string;
  GOOGLE_SEARCH_ENGINE_ID: string;
  SERPER_API_KEY?: string;
  ZENSERP_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
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
  tbs?: string;
}

// Intermediary Search Schema - Common interface for all search engines
export interface IntermediarySearchResult {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  description: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType: string;
  fileFormat: string;
}

export interface IntermediaryPaginationInfo {
  currentPage: number;
  totalResults: number;
  resultsPerPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextStartIndex?: number;
  previousStartIndex?: number;
}

export interface IntermediarySearchResponse {
  results: IntermediarySearchResult[];
  pagination: IntermediaryPaginationInfo;
  searchInfo: {
    query: string;
    orientation?: 'landscape' | 'portrait';
    searchTime: number;
    searchEngine: string;
    timestamp: string;
  };
}

// Abstract Search Engine Interface
export interface SearchEngine {
  name: string;
  supportsTbs: boolean;
  search(request: SearchRequest): Promise<ApiResponse<IntermediarySearchResponse>>;
  healthCheck(): Promise<{ healthy: boolean; message: string }>;
}

// Google Search API specific types (kept for internal use)
export interface GoogleSearchResponse {
  items: GoogleSearchResultItem[];
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

export interface GoogleSearchResultItem {
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

// Legacy types for backward compatibility (deprecated)
export interface SearchResponse extends GoogleSearchResponse {}
export interface SearchResultItem extends GoogleSearchResultItem {}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Brave Search API specific types
export interface BraveSearchResponse {
  type: string;
  query: {
    original: string;
    spellcheck_off?: boolean;
    show_strict_warning?: boolean;
    altered?: string;
  };
  results: BraveImageResult[];
  extra?: {
    might_be_offensive?: boolean;
  };
}

export interface BraveImageResult {
  type: string;
  title: string;
  url: string;
  source: string;
  page_fetched?: string;
  thumbnail: {
    src: string;
  };
  properties: {
    url: string;
    placeholder?: string;
  };
  meta_url?: {
    scheme: string;
    netloc: string;
    hostname: string;
    favicon?: string;
    path?: string;
  };
  confidence?: string;
} 