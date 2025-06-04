import { Hono } from 'hono';
import { UnifiedSearchService } from '../services/unifiedSearchService';
import { CacheService } from '../services/cacheService';
import { SearchRequest, Bindings, JWTPayload } from '../types';

const search = new Hono<{ 
  Bindings: Bindings;
  Variables: {
    jwtPayload: JWTPayload;
  };
}>();

// Initialize unified search service
const getUnifiedSearchService = (env: Bindings) => {
  return new UnifiedSearchService(env);
};

// Protected search endpoint - main image search with caching
search.get('/images', async (c) => {
  try {
    const searchService = getUnifiedSearchService(c.env);
    const payload = c.get('jwtPayload');
    
    // Extract query parameters
    const query = c.req.query('q') || c.req.query('query');
    const orientation = c.req.query('orientation') as 'landscape' | 'portrait' | undefined;
    const count = c.req.query('count') ? parseInt(c.req.query('count')!) : undefined;
    const start = c.req.query('start') ? parseInt(c.req.query('start')!) : undefined;
    const engine = c.req.query('engine'); // Optional engine selection

    if (!query) {
      return c.json({
        success: false,
        error: 'Query parameter "q" or "query" is required'
      }, 400);
    }

    const searchRequest: SearchRequest = {
      query,
      orientation,
      count,
      start
    };

    // Create cache key for this search request (include engine in cache key)
    const cacheKey = CacheService.createSearchCacheKey(
      { ...searchRequest, engine }, 
      payload.sub
    );

    // Use cache-aware search operation
    const { data: result, fromCache } = await CacheService.withCache(
      cacheKey,
      async () => {
        return await searchService.search(searchRequest, engine);
      },
      'search'
    );

    if (!result.success) {
      return c.json(result, 400);
    }

    // Add user context and cache info to response
    return c.json({
      ...result,
      user: payload.sub,
      searchedAt: new Date().toISOString(),
      cached: fromCache,
      cacheKey: fromCache ? cacheKey : undefined
    });

  } catch (error) {
    console.error('Search endpoint error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Protected search suggestions endpoint with caching
search.get('/suggestions', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const category = c.req.query('category') || 'general';
    
    // Create cache key for suggestions
    const cacheKey = CacheService.createSuggestionsCacheKey(category);

    // Use cache-aware suggestions operation
    const { data: suggestionsData, fromCache } = await CacheService.withCache(
      cacheKey,
      async () => {
        const suggestions = {
          general: [
            'nature landscape',
            'abstract art',
            'space galaxy',
            'minimalist design',
            'city skyline',
            'ocean waves'
          ],
          landscape: [
            'mountain vista',
            'forest path',
            'desert sunset',
            'lake reflection',
            'aurora borealis',
            'canyon view'
          ],
          portrait: [
            'abstract vertical',
            'geometric patterns',
            'botanical close-up',
            'architectural details',
            'texture study',
            'color gradient'
          ]
        };

        return {
          category,
          suggestions: suggestions[category as keyof typeof suggestions] || suggestions.general,
          generatedAt: new Date().toISOString()
        };
      },
      'suggestions'
    );

    return c.json({
      success: true,
      data: {
        ...suggestionsData,
        user: payload.sub,
        requestedAt: new Date().toISOString(),
        cached: fromCache,
        cacheKey: fromCache ? cacheKey : undefined
      }
    });
  } catch (error) {
    console.error('Suggestions endpoint error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Protected search service health check with caching
search.get('/health', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const searchService = getUnifiedSearchService(c.env);
    const engine = c.req.query('engine'); // Optional engine selection
    
    // Create cache key for health check
    const cacheKey = CacheService.createHealthCacheKey();

    // Use cache-aware health check operation
    const { data: healthCheck, fromCache } = await CacheService.withCache(
      cacheKey,
      async () => {
        return await searchService.healthCheck(engine);
      },
      'health'
    );
    
    return c.json({
      success: true,
      data: {
        ...healthCheck,
        checkedBy: payload.sub,
        checkedAt: new Date().toISOString(),
        cached: fromCache,
        cacheKey: fromCache ? cacheKey : undefined
      }
    });
  } catch (error) {
    console.error('Health check endpoint error:', error);
    return c.json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get available search engines
search.get('/engines', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const searchService = getUnifiedSearchService(c.env);
    
    const stats = searchService.getStats();
    const engines = stats.availableEngines.map(key => 
      searchService.getEngineInfo(key)
    ).filter(Boolean);

    return c.json({
      success: true,
      data: {
        engines,
        defaultEngine: stats.defaultEngine,
        totalEngines: stats.totalEngines,
        requestedBy: payload.sub,
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to get engine information'
    }, 500);
  }
});

// Cache management endpoints (for debugging/monitoring)
search.get('/cache/stats', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const stats = CacheService.getCacheStats();
    
    return c.json({
      success: true,
      data: {
        ...stats,
        requestedBy: payload.sub,
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to get cache stats'
    }, 500);
  }
});

search.delete('/cache', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const pattern = c.req.query('pattern') || '.*';
    
    await CacheService.invalidateCache(pattern);
    
    return c.json({
      success: true,
      data: {
        message: `Cache entries matching pattern '${pattern}' have been invalidated`,
        invalidatedBy: payload.sub,
        invalidatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to invalidate cache'
    }, 500);
  }
});

search.delete('/cache/clear', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    CacheService.clearCache();
    
    return c.json({
      success: true,
      data: {
        message: 'All cache entries have been cleared',
        clearedBy: payload.sub,
        clearedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to clear cache'
    }, 500);
  }
});

export { search }; 