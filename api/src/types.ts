export interface SearchRequest {
  query: string;
  orientation?: 'landscape' | 'portrait';
  count?: number;
  start?: number;
  engine?: string;
  tbs?: string; // Time-based search parameter (e.g., "qdr:w" for past week)
}

export interface GoogleSearchResponseItemImage {
  contextLink: string;
  height: number;
  width: number;
  byteSize: number;
  thumbnailLink: string;
  thumbnailHeight: number;
  thumbnailWidth: number;
}

export interface GoogleSearchResponseItem {
  kind: string;
  title: string;
  htmlTitle: string;
  link: string;
  displayLink: string;
  snippet: string;
  htmlSnippet: string;
  mime: string;
  fileFormat: string;
  image: GoogleSearchResponseItemImage;
}

export interface GoogleSearchResponseQueriesPage {
  title: string;
  totalResults: string;
  searchTerms: string;
  count: number;
  startIndex: number;
  inputEncoding: string;
  outputEncoding: string;
  safe: string;
  cx: string;
  searchType?: string;
}

export interface GoogleSearchResponseQueries {
  request: GoogleSearchResponseQueriesPage[];
  nextPage?: GoogleSearchResponseQueriesPage[];
  previousPage?: GoogleSearchResponseQueriesPage[];
}

export interface GoogleSearchResponseContext {
  title: string;
}

export interface GoogleSearchResponseSearchInformation {
  searchTime: number;
  formattedSearchTime: string;
  totalResults: string;
  formattedTotalResults: string;
}

export interface GoogleSearchResponse {
  kind: string;
  url: object; 
  queries: GoogleSearchResponseQueries;
  context: GoogleSearchResponseContext;
  searchInformation: GoogleSearchResponseSearchInformation;
  items?: GoogleSearchResponseItem[];
}

// Brave Search API Types
export interface BraveImageResultProperties {
  url: string; // Direct image URL
  // Other properties if available and needed
}

export interface BraveImageResultThumbnail {
  src: string; // Thumbnail URL
  // Other properties if available and needed
}

export interface BraveImageResult {
  title?: string;
  url: string; // Page URL where the image is found
  source: string; // Source domain
  properties: BraveImageResultProperties;
  thumbnail: BraveImageResultThumbnail;
  // Other fields if available and needed
}

export interface BraveSearchResponse {
  results?: BraveImageResult[];
  // Other fields from Brave API response if needed
}

export interface IntermediarySearchResult {
  id: string; // Unique ID for this item (e.g., hash of URL)
  title?: string;
  url: string; // Direct link to the image
  thumbnailUrl?: string;
  sourceUrl?: string; // Link to the page where the image was found
  sourceDomain?: string;
  description?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  fileFormat?: string;
  sourceEngine?: string; // Name of the engine that found this result (e.g., 'google', 'brave')
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
    query?: string;
    orientation?: string;
    searchTime?: number;
    searchEngine?: string;
    timestamp?: string;
  };
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // Added optional message field
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface JWTPayload {
  iss: string;
  sub: string;
  aud: string[];
  iat: number;
  exp: number;
  scope: string;
  azp: string;
  // Add any other custom claims your Auth0 setup uses
  [key: string]: any; 
}

export interface Bindings {
  DB: D1Database;
  AGGREGATED_RESULTS_DO: DurableObjectNamespace;
  // Secrets for search engines
  GOOGLE_SEARCH_API_KEY: string;
  GOOGLE_SEARCH_ENGINE_ID: string;
  BRAVE_SEARCH_API_KEY?: string;
  SERPER_API_KEY?: string;
  // Other env vars
  LOG_REQUESTS?: string;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  // Add other bindings as needed
}

// Base SearchEngine interface
export interface SearchEngine {
  readonly name: string;
  readonly supportsTbs?: boolean;
  search(request: SearchRequest): Promise<ApiResponse<IntermediarySearchResponse>>;
  healthCheck?(): Promise<{ healthy: boolean; message: string }>;
}

// For services that might implement a unified search strategy (not strictly used by GoogleSearchEngine but good for consistency)
export interface UnifiedSearchEngine extends SearchEngine {} 