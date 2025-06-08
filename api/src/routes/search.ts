import { Hono } from 'hono';
import { UnifiedSearchService } from '../services/unifiedSearchService';
import { AggregatedSearchService } from '../services/aggregatedSearchService';
import { CacheService } from '../services/cacheService';
import { SearchRequest, Bindings, JWTPayload } from '../types';
import { debugLog } from '../services/queryUtils';

const USE_AGGREGATED_SEARCH = true;

const search = new Hono<{ 
  Bindings: Bindings & { DB: any };
  Variables: {
    jwtPayload: JWTPayload;
  };
}>();

// Initialize unified search service
const getUnifiedSearchService = (env: Bindings) => {
  return new UnifiedSearchService(env);
};

const getAggregatedSearchService = (db: any, env: Bindings) => {
  return new AggregatedSearchService(db, env);
};

// Protected search endpoint - main image search with caching
search.get('/images', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const query = c.req.query('q') || c.req.query('query');
    const orientation = c.req.query('orientation') as 'landscape' | 'portrait' | undefined;
    const count = c.req.query('count') ? parseInt(c.req.query('count')!) : undefined;
    const start = c.req.query('start') ? parseInt(c.req.query('start')!) : undefined;
    const engine = c.req.query('engine');
    const tbs = c.req.query('tbs');

    // Debug logging for incoming request
    debugLog('LOG_REQUESTS', '📥 [SEARCH REQUEST]', {
      user: payload.sub,
      query,
      orientation,
      count,
      start,
      engine,
      tbs,
      timestamp: new Date().toISOString(),
      userAgent: c.req.header('User-Agent'),
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')
    });

    if (!query) {
      debugLog('LOG_REQUESTS', '⚠️ [REQUEST ERROR]', {
        user: payload.sub,
        error: 'Missing query parameter'
      });
      return c.json({
        success: false,
        error: 'Query parameter "q" or "query" is required'
      }, 400);
    }

    const searchRequest: SearchRequest = {
      query,
      orientation,
      count,
      start,
      tbs
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
        if (USE_AGGREGATED_SEARCH) {
          const service = getAggregatedSearchService(c.env.DB, c.env);
          return await service.search(searchRequest, payload.sub);
        } else {
          const service = getUnifiedSearchService(c.env);
          return await service.search(searchRequest, engine);
        }
      },
      'search'
    );

    if (!result.success) {
      debugLog('LOG_RESPONSES', '❌ [SEARCH FAILED]', {
        user: payload.sub,
        query,
        engine,
        error: result.error
      });
      return c.json(result, 400);
    }

    // Debug logging for successful response
    debugLog('LOG_RESPONSES', '📤 [SEARCH RESPONSE]', {
      user: payload.sub,
      query,
      engine: result.data?.searchInfo?.searchEngine,
      resultsCount: result.data?.results?.length,
      totalResults: result.data?.pagination?.totalResults,
      cached: fromCache,
      searchTime: result.data?.searchInfo?.searchTime
    });

    // Add user context and cache info to response
    return c.json({
      ...result,
      user: payload.sub,
      searchedAt: new Date().toISOString(),
      cached: fromCache,
      cacheKey: fromCache ? cacheKey : undefined
    });

  } catch (error) {
    debugLog('LOG_RESPONSES', '💥 [ROUTE EXCEPTION]', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    return c.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// New endpoint for search suggestions
search.get('/suggestions', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const prefix = c.req.query('q');

    // Return empty if no prefix or prefix is too short (e.g., less than 2 chars)
    if (!prefix || prefix.length < 2) {
      return c.json({
        success: true,
        data: []
      }, 200);
    }

    const service = getAggregatedSearchService(c.env.DB, c.env);
    const suggestions = await service.getSearchSuggestions(prefix, payload.sub);

    return c.json({
      success: true,
      data: suggestions
    }, 200);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching suggestions';
    debugLog('LOG_REQUESTS', '❌ [SUGGESTION FAILED]', { error: errorMessage });
    // It's good practice to log the actual error object for more details if possible
    // console.error(error); 
    return c.json({ success: false, error: 'Failed to fetch suggestions' }, 500);
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

// New endpoint to clear user-specific cache
search.post('/cache/clear', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.sub;

    if (!userId) {
      return c.json({ success: false, error: 'User authentication required.' }, 401);
    }

    const service = getAggregatedSearchService(c.env.DB, c.env);
    const result = await service.clearUserCache(userId);

    if (result.success) {
      return c.json({ success: true, message: result.message }, 200);
    } else {
      return c.json({ success: false, error: result.error || 'Failed to clear cache' }, 500);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error clearing cache';
    debugLog('LOG_REQUESTS', '💥 [CACHE CLEAR ENDPOINT EXCEPTION]', { error: errorMessage });
    return c.json({ success: false, error: 'An unexpected server error occurred.' }, 500);
  }
});

export { search }; 