// Intermediary Search Schema - matches backend
export interface SearchResult {
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
  source_engine?: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalResults: number;
  resultsPerPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextStartIndex?: number;
  previousStartIndex?: number;
}

export interface SearchData {
  results: SearchResult[];
  pagination: PaginationInfo;
  searchInfo: {
    query: string;
    orientation?: 'landscape' | 'portrait';
    searchTime: number;
    searchEngine: string;
    timestamp: string;
  };
}

export interface SearchResponse {
  success: boolean;
  data: SearchData;
  message: string;
  user: string;
  searchedAt: string;
  cached?: boolean;
  cacheKey?: string;
}

// Legacy types for backward compatibility (deprecated)
export interface SearchImage {
  kind: string;
  title: string;
  htmlTitle: string;
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

export interface SearchQueries {
  request: Array<{
    title: string;
    totalResults: string;
    searchTerms: string;
    count: number;
    startIndex: number;
    inputEncoding: string;
    outputEncoding: string;
    safe: string;
    cx: string;
    searchType: string;
    imgSize: string;
    imgType: string;
  }>;
  nextPage?: Array<{
    title: string;
    totalResults: string;
    searchTerms: string;
    count: number;
    startIndex: number;
    inputEncoding: string;
    outputEncoding: string;
    safe: string;
    cx: string;
    searchType: string;
    imgSize: string;
    imgType: string;
  }>;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  timestamp: string;
}

export interface SearchParams {
  q: string;
  orientation?: 'landscape' | 'portrait';
  count?: number;
  start?: number;
  engine?: string;
} 