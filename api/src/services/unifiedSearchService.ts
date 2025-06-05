import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  ApiResponse,
  Bindings 
} from '../types';
import { GoogleSearchEngine } from './googleSearchEngine';
import { MockSearchEngine } from './mockSearchEngine';
import { SerperSearchEngine } from './serperSearchEngine';
import { ZenserpSearchEngine } from './zenserpSearchEngine';
import { BraveSearchEngine } from './braveSearchEngine';
import { SEARCH_ENGINE_CONFIG } from '../config/searchEngines';
import { debugLog } from './queryUtils';

export class UnifiedSearchService {
  private searchEngines: Map<string, SearchEngine> = new Map();
  private defaultEngine: string = SEARCH_ENGINE_CONFIG.DEFAULT_ENGINE;

  constructor(env: Bindings) {
    // Initialize Brave Search Engine if API key is available (highest priority)
    if (env.BRAVE_SEARCH_API_KEY) {
      const braveEngine = new BraveSearchEngine(env.BRAVE_SEARCH_API_KEY);
      this.searchEngines.set(SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.BRAVE, braveEngine);
    } else {
      console.warn('Brave Search API key not found');
    }

    // Initialize Zenserp Search Engine if API key is available
    if (env.ZENSERP_API_KEY) {
      const zenserpEngine = new ZenserpSearchEngine(env.ZENSERP_API_KEY);
      this.searchEngines.set(SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.ZENSERP, zenserpEngine);
    } else {
      console.warn('Zenserp API key not found');
    }

    // Initialize Serper Search Engine if API key is available
    if (env.SERPER_API_KEY) {
      const serperEngine = new SerperSearchEngine(env.SERPER_API_KEY);
      this.searchEngines.set(SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.SERPER, serperEngine);
    } else {
      console.warn('Serper API key not found');
    }

    // Initialize Google Search Engine if credentials are available
    if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_ENGINE_ID) {
      const googleEngine = new GoogleSearchEngine(
        env.GOOGLE_SEARCH_API_KEY, 
        env.GOOGLE_SEARCH_ENGINE_ID
      );
      this.searchEngines.set(SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.GOOGLE, googleEngine);
    } else {
      console.warn('Google Search API credentials not found');
    }

    // Always add mock search engine for testing/fallback
    const mockEngine = new MockSearchEngine();
    this.searchEngines.set(SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.MOCK, mockEngine);

    // Set default engine based on configuration
    this.setDefaultEngineFromConfig();
  }

  /**
   * Set the default engine based on configuration
   */
  private setDefaultEngineFromConfig(): void {
    if (SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.USE_OPTIMAL_SELECTION) {
      // Use optimal selection based on priority order
      this.setOptimalDefaultEngine();
    } else {
      // Use forced engine from configuration
      const forcedEngine = SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.FORCE_ENGINE;
      
      if (this.searchEngines.has(forcedEngine)) {
        this.defaultEngine = forcedEngine;
        debugLog('LOG_ENGINE_SELECTION', '🎯 [FORCED ENGINE]', {
          forcedEngine,
          engineName: this.searchEngines.get(forcedEngine)?.name,
          reason: 'Configuration forced engine selection'
        });
      } else if (SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.FALLBACK_TO_OPTIMAL) {
        // Fallback to optimal selection if forced engine is not available
        debugLog('LOG_ENGINE_SELECTION', '⚠️ [FORCED ENGINE UNAVAILABLE]', {
          forcedEngine,
          fallbackToOptimal: true,
          availableEngines: Array.from(this.searchEngines.keys())
        });
        this.setOptimalDefaultEngine();
      } else {
        // No fallback, use mock engine
        this.defaultEngine = SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.MOCK;
        debugLog('LOG_ENGINE_SELECTION', '❌ [FORCED ENGINE FAILED]', {
          forcedEngine,
          fallbackToOptimal: false,
          usingMock: true
        });
      }
    }
  }

  /**
   * Set the optimal default engine based on available credentials and priority order
   */
  private setOptimalDefaultEngine(): void {
    const priorityOrder = SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.PRIORITY_ORDER;
    
    for (const engineKey of priorityOrder) {
      if (this.searchEngines.has(engineKey)) {
        this.defaultEngine = engineKey;
        debugLog('LOG_ENGINE_SELECTION', '🔄 [OPTIMAL ENGINE]', {
          selectedEngine: engineKey,
          engineName: this.searchEngines.get(engineKey)?.name,
          priorityOrder,
          reason: 'Optimal selection based on priority and availability'
        });
        return;
      }
    }

    // Fallback to mock if no engines are available (shouldn't happen)
    this.defaultEngine = SEARCH_ENGINE_CONFIG.AVAILABLE_ENGINES.MOCK;
    console.warn('No external search engines available, using mock search engine as fallback');
  }

  /**
   * Add a new search engine
   */
  addSearchEngine(key: string, engine: SearchEngine): void {
    this.searchEngines.set(key, engine);
  }

  /**
   * Set the default search engine
   */
  setDefaultEngine(engineKey: string): void {
    if (!this.searchEngines.has(engineKey)) {
      throw new Error(`Search engine '${engineKey}' not found`);
    }
    this.defaultEngine = engineKey;
  }

  /**
   * Get available search engines
   */
  getAvailableEngines(): string[] {
    return Array.from(this.searchEngines.keys());
  }

  /**
   * Get search engine info
   */
  getEngineInfo(engineKey?: string): { name: string; key: string } | null {
    const key = engineKey || this.defaultEngine;
    const engine = this.searchEngines.get(key);
    return engine ? { name: engine.name, key } : null;
  }

  /**
   * Perform search using specified or default engine
   */
  async search(
    request: SearchRequest, 
    engineKey?: string
  ): Promise<ApiResponse<IntermediarySearchResponse>> {
    const key = engineKey || this.defaultEngine;
    const engine = this.searchEngines.get(key);

    if (!engine) {
      debugLog('LOG_ENGINE_SELECTION', '❌ [ENGINE ERROR]', {
        requestedEngine: key,
        availableEngines: Array.from(this.searchEngines.keys()),
        error: 'Engine not available'
      });
      return {
        success: false,
        error: `Search engine '${key}' not available`
      };
    }

    debugLog('LOG_ENGINE_SELECTION', '🚀 [ENGINE SELECTED]', {
      selectedEngine: key,
      engineName: engine.name,
      supportsTbs: engine.supportsTbs,
      isDefault: !engineKey,
      availableEngines: Array.from(this.searchEngines.keys()),
      request: {
        query: request.query,
        orientation: request.orientation,
        count: request.count,
        start: request.start,
        hasTbs: !!request.tbs
      }
    });

    try {
      const result = await engine.search(request);
      
      // Add engine info to successful responses
      if (result.success && result.data) {
        result.data.searchInfo.searchEngine = `${engine.name} (${key})`;
      }

      return result;
    } catch (error) {
      debugLog('LOG_ENGINE_SELECTION', '💥 [UNIFIED SEARCH ERROR]', {
        engine: key,
        engineName: engine.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: `Search failed with engine '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Health check for specified or all engines
   */
  async healthCheck(engineKey?: string): Promise<{ 
    healthy: boolean; 
    engines: Array<{ key: string; name: string; healthy: boolean; message: string }> 
  }> {
    const enginesToCheck = engineKey 
      ? [engineKey] 
      : Array.from(this.searchEngines.keys());

    const results = await Promise.all(
      enginesToCheck.map(async (key) => {
        const engine = this.searchEngines.get(key);
        if (!engine) {
          return {
            key,
            name: 'Unknown',
            healthy: false,
            message: 'Engine not found'
          };
        }

        try {
          const health = await engine.healthCheck();
          return {
            key,
            name: engine.name,
            healthy: health.healthy,
            message: health.message
          };
        } catch (error) {
          return {
            key,
            name: engine.name,
            healthy: false,
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      })
    );

    const allHealthy = results.every(r => r.healthy);

    return {
      healthy: allHealthy,
      engines: results
    };
  }

  /**
   * Get search statistics (for monitoring)
   */
  getStats(): {
    totalEngines: number;
    availableEngines: string[];
    defaultEngine: string;
    engineSelection: {
      useOptimalSelection: boolean;
      forcedEngine: string;
      fallbackToOptimal: boolean;
      priorityOrder: readonly string[];
    };
  } {
    return {
      totalEngines: this.searchEngines.size,
      availableEngines: Array.from(this.searchEngines.keys()),
      defaultEngine: this.defaultEngine,
      engineSelection: {
        useOptimalSelection: SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.USE_OPTIMAL_SELECTION,
        forcedEngine: SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.FORCE_ENGINE,
        fallbackToOptimal: SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.FALLBACK_TO_OPTIMAL,
        priorityOrder: SEARCH_ENGINE_CONFIG.ENGINE_SELECTION.PRIORITY_ORDER
      }
    };
  }
} 