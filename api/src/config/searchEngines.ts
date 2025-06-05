export const SEARCH_ENGINE_CONFIG = {
  DEFAULT_ENGINE: 'google' as const,
  AVAILABLE_ENGINES: {
    ZENSERP: 'zenserp',
    SERPER: 'serper',
    GOOGLE: 'google',
    MOCK: 'mock'
  } as const,
  ENGINE_SELECTION: {
    USE_OPTIMAL_SELECTION: false,  // If true, automatically selects best available engine
    FORCE_ENGINE: 'google' as const, // Force this specific engine (when USE_OPTIMAL_SELECTION is false)
    FALLBACK_TO_OPTIMAL: true,     // If forced engine unavailable, fall back to optimal selection
    PRIORITY_ORDER: ['zenserp', 'serper', 'google', 'mock'] as const // Priority for optimal selection
  } as const,
  TBS_SUPPORT: {
    ZENSERP: true,  // Zenserp supports TBS parameters
    SERPER: true,   // Serper supports TBS parameters
    GOOGLE: true,   // Google supports TBS parameters
    MOCK: false     // Mock engine doesn't need TBS support
  } as const,
  DEBUG: {
    ENABLED: true,           // Enable/disable debug logging
    LOG_REQUESTS: true,      // Log incoming search requests
    LOG_RESPONSES: true,     // Log search responses
    LOG_ENGINE_SELECTION: true, // Log which engine was selected
    LOG_QUERY_BUILDING: true,   // Log query building process
    LOG_API_CALLS: true,     // Log actual API calls to search engines
    HIDE_API_KEYS: true      // Hide API keys in logs (recommended)
  } as const
};

export type SearchEngineKey = typeof SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES[keyof typeof SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES]; 