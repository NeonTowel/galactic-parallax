import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwk } from 'hono/jwk';
import { search } from './routes/search';
import { Bindings, JWTPayload } from './types';

const app = new Hono<{ 
  Bindings: Bindings;
  Variables: {
    jwtPayload: JWTPayload;
  };
}>();

// Environment validation function
function validateEnvironment(env: Bindings): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required Auth0 configuration
  if (!env.AUTH0_DOMAIN) {
    errors.push('AUTH0_DOMAIN is required');
  }
  if (!env.AUTH0_AUDIENCE) {
    errors.push('AUTH0_AUDIENCE is required');
  }
  
  // Required Google Search API configuration
  if (!env.GOOGLE_SEARCH_API_KEY) {
    errors.push('GOOGLE_SEARCH_API_KEY is required');
  }
  if (!env.GOOGLE_SEARCH_ENGINE_ID) {
    errors.push('GOOGLE_SEARCH_ENGINE_ID is required');
  }
  
  // Validate Auth0 domain format
  if (env.AUTH0_DOMAIN && !env.AUTH0_DOMAIN.includes('.auth0.com')) {
    errors.push('AUTH0_DOMAIN must be a valid Auth0 domain (e.g., your-tenant.auth0.com)');
  }
  
  // Validate Google Search Engine ID format (basic check)
  if (env.GOOGLE_SEARCH_ENGINE_ID && env.GOOGLE_SEARCH_ENGINE_ID.length < 10) {
    errors.push('GOOGLE_SEARCH_ENGINE_ID appears to be invalid (too short)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Middleware to validate environment on each request
app.use('*', async (c, next) => {
  const validation = validateEnvironment(c.env);
  
  if (!validation.isValid) {
    return c.json({
      success: false,
      error: 'Server configuration error',
      details: validation.errors,
      message: 'The server is not properly configured. Please check environment variables.'
    }, 500);
  }
  
  await next();
});

// CORS configuration for SvelteKit frontend
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://galactic-parallax.netlify.app', 'http://127.0.0.1:5173', 'https://parallax.neontowel.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// JWT middleware for protected routes with enhanced error handling
app.use('/api/search/*', async (c, next) => {
  try {
    const jwkMiddleware = jwk({
      jwks_uri: `https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    });
    return jwkMiddleware(c, next);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Authentication service error',
      message: 'Unable to validate JWT token. Please check your Auth0 configuration.'
    }, 500);
  }
});

// Mount search routes - all search endpoints require authentication
app.route('/api/search', search);

// Public routes
app.get('/', (c) => {
  return c.json({ 
    message: 'Galactic Parallax API is running!',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Enhanced health check with environment validation
app.get('/api/health', (c) => {
  const validation = validateEnvironment(c.env);
  
  const healthStatus = {
    status: validation.isValid ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      auth0: {
        configured: !!(c.env.AUTH0_DOMAIN && c.env.AUTH0_AUDIENCE),
        domain: c.env.AUTH0_DOMAIN ? `${c.env.AUTH0_DOMAIN.substring(0, 10)}...` : 'not configured'
      },
      googleSearch: {
        configured: !!(c.env.GOOGLE_SEARCH_API_KEY && c.env.GOOGLE_SEARCH_ENGINE_ID),
        hasApiKey: !!c.env.GOOGLE_SEARCH_API_KEY,
        hasSearchEngineId: !!c.env.GOOGLE_SEARCH_ENGINE_ID
      }
    }
  };
  
  if (!validation.isValid) {
    return c.json({
      ...healthStatus,
      errors: validation.errors,
      message: 'Service is unhealthy due to configuration issues'
    }, 503);
  }
  
  return c.json(healthStatus);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  
  return c.json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again later.',
    timestamp: new Date().toISOString()
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
    message: `The requested endpoint ${c.req.method} ${c.req.path} was not found.`,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/search/images (requires auth)',
      'GET /api/search/suggestions (requires auth)',
      'GET /api/search/health (requires auth)'
    ]
  }, 404);
});

export default app;
