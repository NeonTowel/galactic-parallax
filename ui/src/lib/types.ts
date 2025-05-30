// Search result types based on the API response structure
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

export interface SearchData {
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: SearchQueries;
  context: {
    title: string;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items: SearchImage[];
}

export interface SearchResponse {
  success: boolean;
  data: SearchData;
  message: string;
  user: string;
  searchedAt: string;
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
} 