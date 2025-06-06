# API Versioning & Layered Monolith Endpoint Schema

## 1. Versioning Strategy

All endpoints remain under the single domain:
https://parallax.apis.neontowel.dev

- Current API endpoints move under `/v1/`.
  - Example: `/api/search` → `/v1/api/search`
- Layered Monolith (Workers) endpoints live under `/v2/`.
  - Example: `/v2/api/search/images`

## 2. Authentication

### Current Implementation (v1)

- **Provider**: Auth0 JWT authentication
- **Method**: Bearer token in Authorization header
- **Protected Routes**: All `/api/search/*` endpoints require authentication
- **Public Routes**: `/`, `/api/health`

### Authentication Flow

1. Frontend authenticates with Auth0 SPA client
2. Auth0 returns JWT token
3. Frontend includes JWT in `Authorization: Bearer <token>` header
4. API validates JWT using Auth0 JWKS endpoint
5. JWT payload (including `sub` user ID) stored in request context

### Required Environment Variables

```
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=your-api-audience
```

### JWT Payload Structure

```typescript
interface JWTPayload {
  sub: string; // User ID
  permissions?: string[]; // Optional permissions
  [key: string]: any; // Additional Auth0 claims
}
```

## 3. Routing Overview

### v1 (Legacy/Current Monolith)

**Protected Endpoints (Require JWT)**:

- `/v1/api/search`
- `/v1/api/search/images`

**Public Endpoints**:

- `/v1/`
- `/v1/api/health`

### v2 (Layered Monolith Workers)

**Protected Endpoints (Require JWT)**:

- `/v2/api/search/images`
- `/v2/api/search/engines/:engine`
- `/v2/api/search/metadata`
- `/v2/api/search/process`

**Public Endpoints**:

- `/v2/`
- `/v2/api/health`

**Internal Worker Endpoints (Not Public)**:

- `/v2/engines/*`
- `/v2/processors/*`
- `/v2/storage/*`
- `/v2/orchestration/*`

## 4. Layered Monolith v2: Endpoint Schema

### API Gateway Layer

- `/v2/api/search/images` (Protected)

### Orchestration Layer

- `/v2/orchestration/search` (Internal)

### Engine Layer

- `/v2/engines/google/search` (Internal)
- `/v2/engines/brave/search` (Internal)
- `/v2/engines/serper/search` (Internal)
- `/v2/engines/:engine/health` (Internal)
- `/v2/engines/:engine/info` (Internal)

### Processing Layer

- `/v2/processors/deduplicate` (Internal)
- `/v2/processors/keywords` (Internal)
- `/v2/processors/enhance` (Internal)

### Storage Layer

- `/v2/storage/cache/get` (Internal)
- `/v2/storage/cache/set` (Internal)
- `/v2/storage/metadata/query` (Internal)
- `/v2/storage/metadata/store` (Internal)

### Infrastructure Layer

- No direct endpoints; shared types/config

## 5. Example: v2 API Schema

| Endpoint                         | Method | Description                                | Layer       | Auth Required |
| -------------------------------- | ------ | ------------------------------------------ | ----------- | ------------- |
| `/v2/api/search/images`          | POST   | Search images (multi-engine, orchestrated) | API Gateway | Yes           |
| `/v2/api/search/engines/:engine` | POST   | Direct search via specific engine          | Engine      | Yes           |
| `/v2/api/search/metadata`        | GET    | Query search metadata                      | Storage     | Yes           |
| `/v2/api/search/process`         | POST   | Run processing (dedup, keywords, etc)      | Processing  | Yes           |
| `/v2/engines/:engine/search`     | POST   | Engine worker direct search                | Engine      | Internal      |
| `/v2/engines/:engine/health`     | GET    | Engine health check                        | Engine      | Internal      |
| `/v2/engines/:engine/info`       | GET    | Engine capabilities                        | Engine      | Internal      |
| `/v2/processors/deduplicate`     | POST   | Deduplicate results                        | Processing  | Internal      |
| `/v2/processors/keywords`        | POST   | Extract keywords                           | Processing  | Internal      |
| `/v2/storage/cache/get`          | POST   | Get cache entry                            | Storage     | Internal      |
| `/v2/storage/cache/set`          | POST   | Set cache entry                            | Storage     | Internal      |
| `/v2/storage/metadata/query`     | POST   | Query metadata (D1 SQL)                    | Storage     | Internal      |
| `/v2/storage/metadata/store`     | POST   | Store metadata                             | Storage     | Internal      |

## 6. Authentication in Layered Monolith

### API Gateway Authentication

- Validates JWT tokens using Auth0 JWKS
- Extracts user context from JWT payload
- Passes user context to downstream workers

### Inter-Worker Authentication

- **Option A**: Pass JWT token through to workers
- **Option B**: Use internal service tokens between workers
- **Option C**: Trust internal network (workers authenticate at gateway only)

### Recommended Approach for v2

```typescript
// API Gateway validates JWT and extracts user context
interface WorkerRequest {
  // Original request data
  query: string;
  // User context from JWT
  user: {
    id: string;
    permissions?: string[];
  };
  // Request metadata
  requestId: string;
  timestamp: string;
}
```

## 7. Routing Implementation Notes

- API Gateway handles all `/v2/api/*` routes, validates JWT, delegates to orchestration/engine/processing/storage as needed.
- Internal Worker Endpoints (`/v2/engines/*`, `/v2/processors/*`, `/v2/storage/*`) are not public, but can be exposed for admin/monitoring.
- Frontend and clients should be updated to use `/v1/` or `/v2/` as needed.
- No subdomains; all routing is path-based under the main domain.
- User context from JWT is available throughout the request pipeline.

## 8. Migration/Transition

- Move all current endpoints to `/v1/`.
- Begin implementing new/refactored endpoints under `/v2/`.
- Both versions can run in parallel for gradual migration.
- Authentication remains consistent across both versions.
