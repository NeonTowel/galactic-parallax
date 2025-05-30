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

// CORS configuration for SvelteKit frontend
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://galactic-parallax.netlify.app', 'http://127.0.0.1:5173', 'https://parallax.neontowel.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// JWT middleware for protected routes
app.use('/api/search/*', async (c, next) => {
  const jwkMiddleware = jwk({
    jwks_uri: `https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  });
  return jwkMiddleware(c, next);
});

// Mount search routes under protected path - all search endpoints require authentication
app.route('/api/search', search);

// Public routes
app.get('/', (c) => {
  return c.json({ message: 'Hono.js API is running!' });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default app;
