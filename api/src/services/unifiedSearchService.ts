import { 
  SearchEngine, 
  SearchRequest, 
  IntermediarySearchResponse, 
  ApiResponse,
  Bindings 
} from '../types';
import { GoogleSearchEngine } from './googleSearchEngine';
import { MockSearchEngine } from './mockSearchEngine';

export class UnifiedSearchService {
  private searchEngines: Map<string, SearchEngine> = new Map();
  private defaultEngine: string = 'google';

  constructor(env: Bindings) {
    // Initialize Google Search Engine if credentials are available
    if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_ENGINE_ID) {
      const googleEngine = new GoogleSearchEngine(
        env.GOOGLE_SEARCH_API_KEY, 
        env.GOOGLE_SEARCH_ENGINE_ID
      );
      this.searchEngines.set('google', googleEngine);
      this.defaultEngine = 'google';
    } else {
      console.warn('Google Search API credentials not found, using mock search engine as fallback');
    }

    // Always add mock search engine for testing/fallback
    const mockEngine = new MockSearchEngine();
    this.searchEngines.set('mock', mockEngine);

    // If Google is not available, use mock as default
    if (!this.searchEngines.has('google')) {
      this.defaultEngine = 'mock';
    }
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
      return {
        success: false,
        error: `Search engine '${key}' not available`
      };
    }

    try {
      const result = await engine.search(request);
      
      // Add engine info to successful responses
      if (result.success && result.data) {
        result.data.searchInfo.searchEngine = `${engine.name} (${key})`;
      }

      return result;
    } catch (error) {
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
  } {
    return {
      totalEngines: this.searchEngines.size,
      availableEngines: Array.from(this.searchEngines.keys()),
      defaultEngine: this.defaultEngine
    };
  }
} 