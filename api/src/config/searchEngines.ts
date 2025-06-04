export const SEARCH_ENGINE_CONFIG = {
  DEFAULT_ENGINE: 'serper' as const,
  AVAILABLE_ENGINES: {
    GOOGLE: 'google',
    SERPER: 'serper',
    MOCK: 'mock'
  } as const
};

export type SearchEngineKey = typeof SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES[keyof typeof SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES]; 