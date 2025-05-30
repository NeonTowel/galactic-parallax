import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwk } from 'hono/jwk';

type Bindings = {
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  JWT_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS configuration for SvelteKit frontend
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://galactic-parallax-dev.netlify.app'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// JWT middleware for protected routes
app.use('/api/protected/*', async (c, next) => {
  const jwkMiddleware = jwk({
    jwks_uri: `https://${c.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  });
  return jwkMiddleware(c, next);
});

// Public routes
app.get('/', (c) => {
  return c.json({ message: 'Hono.js API is running!' });
});

app.get('/api/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Protected routes
app.get('/api/protected/user', (c) => {
  const payload = c.get('jwtPayload');
  return c.json({
    message: 'Protected data',
    user: payload.sub,
    permissions: payload.permissions
  });
});

export default app;
