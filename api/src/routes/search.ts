import { Hono } from 'hono';
import { SearchService } from '../services/searchService';
import { SearchRequest, Bindings, JWTPayload } from '../types';

const search = new Hono<{ 
  Bindings: Bindings;
  Variables: {
    jwtPayload: JWTPayload;
  };
}>();

// Initialize search service
const getSearchService = (env: Bindings) => {
  return new SearchService(env.GOOGLE_SEARCH_API_KEY, env.GOOGLE_SEARCH_ENGINE_ID);
};

// Protected search endpoint - main image search
search.get('/images', async (c) => {
  try {
    const searchService = getSearchService(c.env);
    const payload = c.get('jwtPayload');
    
    // Extract query parameters
    const query = c.req.query('q') || c.req.query('query');
    const orientation = c.req.query('orientation') as 'landscape' | 'portrait' | undefined;
    const count = c.req.query('count') ? parseInt(c.req.query('count')!) : undefined;
    const start = c.req.query('start') ? parseInt(c.req.query('start')!) : undefined;

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

    const result = await searchService.search(searchRequest);

    if (!result.success) {
      return c.json(result, 400);
    }

    // Add user context to response
    return c.json({
      ...result,
      user: payload.sub,
      searchedAt: new Date().toISOString()
    });

  } catch (error) {
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Protected search suggestions endpoint
search.get('/suggestions', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const category = c.req.query('category') || 'general';
    
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

    return c.json({
      success: true,
      data: {
        category,
        suggestions: suggestions[category as keyof typeof suggestions] || suggestions.general,
        user: payload.sub,
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Protected search service health check
search.get('/health', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const searchService = getSearchService(c.env);
    const healthCheck = await searchService.healthCheck();
    
    return c.json({
      success: true,
      data: {
        ...healthCheck,
        checkedBy: payload.sub,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Health check failed'
    }, 500);
  }
});

export { search }; 