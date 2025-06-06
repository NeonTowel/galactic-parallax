Plan & Analysis: Layered Monolith as Cloudflare Workers

Step 1: Understand the Current State

- The current API (in ./api) is a monolith with some abstraction, but not yet modularized into clear layers or Workers.
- **Authentication**: Uses Auth0 JWT authentication with Bearer tokens, validates JWT using JWKS endpoint.
- **Protected Routes**: All `/api/search/*` endpoints require authentication, user context available via JWT payload.
- **User Context**: JWT payload includes user ID (`sub`), email, permissions, and other Auth0 claims.
- Caching is basic and only for Serper.
- No unified multi-engine orchestration, deduplication, or advanced storage.
- Pagination is inconsistent due to engine differences.
- Storage is not yet using Cloudflare KV or SQL.

Step 2: Brainstorm Layered Monolith as Workers

A. Layered Monolith Pattern (Cloudflare Workers)

- Each logical layer is a separate Worker, communicating via HTTP or Durable Objects.
- **Authentication**: JWT validation happens at API Gateway, user context passed to downstream workers.
- Layers are:
  1. API Gateway Layer: Receives user requests, **validates JWT tokens**, handles auth/rate limiting, routes to Orchestration.
  2. Orchestration Layer: Coordinates multi-engine search, aggregates results, manages pagination logic, **receives user context**.
  3. Engine Layer: Each search engine (Google, Serper, Brave, etc.) is a module or Worker, with its own caching, **user-aware caching**.
  4. Processing Layer: Handles deduplication, keyword extraction, result enhancement, **user personalization**.
  5. Storage Layer: Abstracts Cloudflare KV and/or D1 SQL, manages cache, metadata, and indexes, **user-specific data**.
  6. Infrastructure Layer: Shared config, types, utilities, **authentication types**.

B. Worker Communication with Authentication

- API Gateway → Orchestration (main entry, **passes user context**)
- Orchestration → Engine Workers (parallel or sequential, **includes user preferences**)
- Orchestration → Processing Worker (for enhancement/deduplication, **user personalization**)
- Orchestration/Processing → Storage Worker (for cache, metadata, index, **user-specific storage**)
- All Workers can call Storage Worker as needed, **with user context**.

**Authentication Flow Through Workers**:

```
User Request + JWT → API Gateway (validates JWT) → User Context → Downstream Workers
```

C. Storage Strategy with User Context

- KV: Fast, cheap, good for caching search results, storing small metadata (e.g., image URLs, keywords), **user-specific cache keys**.
- D1 SQL: For building a metadata index, tracking search history, analytics, or more complex queries, **user preferences and history**.
- Hybrid: Use KV for hot cache and simple lookups, D1 for structured, queryable data, **user-specific data separation**.

D. Pagination & Aggregation with User Preferences

- Orchestration Layer slices/merges results from engines, normalizes pagination regardless of engine capability.
- **User Preferences**: Apply user-specific filtering, ranking, and personalization.
- For engines with no pagination, fetch all and slice in-memory.
- For engines with pagination, fetch as needed.

E. Cost & Free Tier Considerations

- Minimize KV writes (batch, chunk, compress).
- Use D1 for infrequent writes, more reads.
- Cache aggressively, TTL based on engine freshness, **user-specific cache strategies**.
- Avoid unnecessary cross-Worker calls.

F. Maintenance & Extensibility

- Each Worker is small, focused, and testable.
- Adding a new engine = new Engine Worker, plug into Orchestration.
- Processing logic can be scaled out if needed (e.g., heavy deduplication).
- **Authentication**: Consistent user context across all workers.

Step 3: Deep Analysis of ./api for Refactoring

A. Directory Structure

api/
routes/ # API Gateway Worker (JWT validation, user context extraction)
orchestration/ # Orchestration Worker (user-aware coordination)
engines/ # Engine Workers (Google, Serper, Brave, etc.) with user context
processors/ # Processing Worker (dedup, keywords, user personalization)
storage/ # Storage Worker (KV, D1) with user-specific data
config/
types/ # Including authentication types
utils/

B. Refactoring Plan with Authentication

1. Extract API Gateway: Move all request handling, **JWT validation**, auth, and routing logic to a dedicated Worker.
2. Modularize Orchestration: Refactor multi-engine coordination, pagination, and aggregation into its own Worker, **receives user context**.
3. Isolate Engine Logic: Each engine gets its own Worker/module, with engine-specific caching and adapters, **user-aware caching**.
4. Centralize Processing: Deduplication, keyword extraction, and result enhancement in a Processing Worker, **user personalization**.
5. Abstract Storage: All cache and metadata operations go through a Storage Worker, which can use KV, D1, or both, **user-specific storage**.
6. Shared Types/Utils: Move all shared types and utilities to a common directory for reuse, **including authentication types**.

C. Migration Steps with Authentication

- Start by extracting the Storage Layer (least risk, most benefit), **add user-specific storage patterns**.
- Next, modularize Engine Layer (one engine at a time), **maintain user context**.
- Then, refactor Orchestration and Processing, **integrate user personalization**.
- Finally, move API Gateway logic to its own Worker, **preserve JWT validation**.

D. Edge Cases & Constraints

- Engines with different pagination: Orchestration must normalize.
- KV write limits: Batch writes, compress, TTL, **user-specific cache strategies**.
- D1 query limits: Use for metadata, not hot cache, **user data separation**.
- Free tier: Monitor usage, optimize aggressively.
- **Authentication**: Ensure user context is properly passed between workers.

E. SQL vs KV for Metadata with User Context

- Use D1 SQL for:
  - Building a metadata index (searchable, relational data)
  - Analytics, search history, advanced queries
  - **User preferences, search history, favorites**
  - **User analytics and behavior tracking**
- Use KV for:
  - Caching search results (fast, simple)
  - Storing image URLs, keywords (if small and not relational)
  - **User-specific cache keys and session data**

Step 4: Summary Table with Authentication

| Layer          | Worker? | Storage | Main Responsibility                      | Authentication Notes                       |
| -------------- | ------- | ------- | ---------------------------------------- | ------------------------------------------ |
| API Gateway    | Yes     | -       | Entry point, **JWT validation**, routing | Validates Auth0 JWT, extracts user context |
| Orchestration  | Yes     | -       | Multi-engine coordination, pagination    | Receives user context, applies preferences |
| Engine (per)   | Yes     | KV      | Calls external API, engine cache         | User-aware caching, personalized results   |
| Processing     | Yes     | KV/D1   | Deduplication, keyword extraction        | User personalization, behavior tracking    |
| Storage        | Yes     | KV/D1   | All cache, metadata, index ops           | User-specific storage, privacy controls    |
| Infrastructure | Shared  | -       | Config, types, utils                     | Authentication types, JWT utilities        |

## Current API Implementation Analysis

### 1. File Mapping to Layers with Authentication

**API Gateway Layer:**

- `api/src/index.ts`: API entry, environment validation, **JWT middleware**, route mounting
- `api/src/routes/search.ts`: Main search route, request parsing, response formatting, **user context usage** (needs splitting)

**Orchestration Layer:**

- `api/src/services/unifiedSearchService.ts`: Orchestrates search across engines, handles aggregation, pagination
- Part of `api/src/routes/search.ts`: Business logic coordination, **user context integration** (needs extraction)

**Engine Layer (per engine):**

- `api/src/services/braveSearchEngine.ts`: Brave search engine implementation
- `api/src/services/googleSearchEngine.ts`: Google search engine implementation
- `api/src/services/serperSearchEngine.ts`: Serper search engine implementation
- `api/src/services/zenserpSearchEngine.ts`: Zenserp search engine implementation
- `api/src/services/mockSearchEngine.ts`: Mock search engine for testing

**Processing Layer:**

- Currently missing - needs to be created for deduplication, keyword extraction, **user personalization**
- Some logic may exist in engine implementations that should be extracted

**Storage Layer:**

- `api/src/services/cacheService.ts`: Caching logic, cache key generation, cache-aware wrappers
- Needs adaptation for KV/D1 abstraction, **user-specific caching**

**Infrastructure Layer:**

- `api/src/services/queryUtils.ts`: Logging, query helpers
- `api/src/services/searchService.ts`: Legacy/shared search logic (needs review)
- `api/src/config/searchEngines.ts`: Engine configuration
- `api/src/types/index.ts`: Type definitions, **including JWT payload and authentication types**

### 2. Code Assessment with Authentication

**Can Be Moved As-Is:**

- Engine modules (`braveSearchEngine.ts`, `googleSearchEngine.ts`, `serperSearchEngine.ts`) - minimal changes needed, **add user context parameter**
- Type definitions (`types/index.ts`) - can be shared across Workers, **already includes authentication types**
- Configuration (`config/searchEngines.ts`) - can be shared
- Utility functions (`queryUtils.ts`) - can be shared

**Needs Refactoring:**

- `routes/search.ts`: Split API Gateway logic from orchestration logic, **preserve JWT validation and user context extraction**
- `unifiedSearchService.ts`: Extract engine calling logic, keep only coordination, **integrate user context**
- `cacheService.ts`: Abstract to work with both KV and D1, create clear interface, **add user-specific caching**
- `index.ts`: Slim down to pure API Gateway concerns, **maintain JWT middleware**

**Missing Components:**

- Processing Worker logic (deduplication, keyword extraction, **user personalization**)
- KV/D1 storage abstraction layer with **user-specific storage patterns**
- Inter-Worker communication interfaces with **user context passing**
- Multi-engine result aggregation logic with **user preferences**

### 3. Phased Migration Plan with Authentication

**Phase 1: Storage Layer Foundation**

- Create Storage Worker with KV/D1 abstraction, **user-specific storage patterns**
- Refactor `cacheService.ts` to use new Storage abstraction, **add user-aware caching**
- Implement hybrid storage strategy (KV for cache, D1 for metadata), **user data separation**
- Test with existing functionality, **preserve user context**

**Phase 2: Engine Layer Modularization**

- Extract Google, Brave, Serper engines to separate Workers, **add user context parameters**
- Implement engine-specific caching via Storage Worker, **user-aware caching**
- Update `unifiedSearchService.ts` to call Engine Workers, **pass user context**
- Prioritize: Google → Brave → Serper (as requested)

**Phase 3: Orchestration Layer**

- Extract orchestration logic from `routes/search.ts` to Orchestration Worker, **preserve user context**
- Implement multi-engine coordination and result aggregation, **apply user preferences**
- Handle pagination normalization across different engine capabilities
- Slim down API Gateway to pure routing, **maintain JWT validation**

**Phase 4: Processing Layer**

- Create Processing Worker for result enhancement, **user personalization**
- Implement deduplication logic across engine results
- Add keyword extraction functionality, **user behavior tracking**
- Integrate with Orchestration Worker, **user context flow**

**Phase 5: Infrastructure Consolidation**

- Move shared types, config, and utilities to Infrastructure Layer, **including authentication types**
- Implement proper inter-Worker communication contracts, **user context passing**
- Add monitoring and error handling across Workers
- Optimize for Cloudflare free tier limits

### 4. Inter-Worker Communication Design with Authentication

**API Contracts with User Context:**

```typescript
// API Gateway → Orchestration (with user context)
interface AuthenticatedSearchRequest {
  query: string;
  engines?: string[];
  pagination?: PaginationParams;
  processing?: ProcessingOptions;
  user: UserContext; // From JWT payload
  requestId: string;
  timestamp: string;
}

// Orchestration → Engine Workers (with user context)
interface AuthenticatedEngineSearchRequest {
  query: string;
  engineSpecificParams: Record<string, any>;
  user: UserContext;
  preferences?: UserPreferences;
}

// Orchestration → Processing Worker (with user context)
interface AuthenticatedProcessingRequest {
  results: SearchResult[];
  operations: ("deduplicate" | "extractKeywords" | "personalize")[];
  user: UserContext;
  searchHistory?: RecentSearch[];
}

// All Workers → Storage Worker (with user context)
interface AuthenticatedStorageRequest {
  operation: "get" | "set" | "delete" | "query";
  key?: string;
  value?: any;
  ttl?: number;
  sql?: string;
  user: UserContext; // For user-specific operations
}
```

**Communication Methods:**

- HTTP requests between Workers (simple, debuggable), **include user context in headers or body**
- Shared types via Infrastructure Layer, **including authentication types**
- Error handling and retry logic
- Request/response logging for debugging, **user context tracking**

### 5. Cost Optimization Strategy with User Context

**KV Usage Optimization:**

- Batch operations where possible
- Compress large payloads before storage
- Implement intelligent TTL based on content freshness
- Use chunking for results exceeding KV limits
- **User-specific cache keys with appropriate TTL**

**D1 Usage Optimization:**

- Use for metadata indexing and analytics
- Batch writes for search history
- Read-heavy operations (search suggestions, popular queries)
- Avoid frequent writes to stay within limits
- **User data separation and privacy controls**

**Worker Communication Optimization:**

- Cache Worker responses locally when possible
- Minimize cross-Worker calls through intelligent batching
- Use parallel calls where appropriate (engine searches)
- Implement circuit breakers for failing Workers
- **Efficient user context passing**

### 6. Implementation Priorities with Authentication

**Immediate (Week 1-2):**

1. Create Storage Worker foundation with **user-specific storage patterns**
2. Refactor cacheService to use new Storage abstraction, **add user-aware caching**
3. Test with existing Serper caching, **preserve user context**

**Short-term (Week 3-4):**

1. Extract Google Engine Worker, **add user context parameter**
2. Extract Brave Engine Worker, **maintain user context**
3. Update orchestration to call Engine Workers, **pass user context**

**Medium-term (Month 2):**

1. Create Orchestration Worker, **preserve user context flow**
2. Implement multi-engine coordination, **apply user preferences**
3. Add basic Processing Worker, **user personalization**

**Long-term (Month 3+):**

1. Advanced processing features, **machine learning for user preferences**
2. Metadata indexing with D1, **user analytics and behavior tracking**
3. Performance optimization
4. Apify engine integration

## Detailed Migration Proposal

### Phase 1: Storage Worker Foundation (Week 1-2)

**1.1 Create Storage Worker Structure:**

```
api/storage/
├── src/
│   ├── index.ts           # Storage Worker entry point
│   ├── services/
│   │   ├── kvService.ts   # KV operations with user context
│   │   ├── d1Service.ts   # D1 SQL operations with user data
│   │   └── cacheManager.ts # Unified cache interface with user-specific keys
│   ├── types/
│   │   └── storage.ts     # Storage-specific types including user context
│   └── config/
│       └── storage.ts     # Storage configuration
├── wrangler.toml          # Storage Worker config
└── package.json
```

**1.2 Key Changes:**

- Extract `CacheService` logic to Storage Worker
- Replace in-memory cache with KV storage, **add user-specific cache keys**
- Add D1 integration for metadata, **user preferences and history**
- Create unified storage interface for other Workers, **user context support**

**1.3 Storage Worker API with User Context:**

```typescript
// Storage Worker endpoints
POST /cache/set     # Store cache entry (user-specific)
GET  /cache/get     # Retrieve cache entry (user-specific)
DELETE /cache/delete # Delete cache entry (user-specific)
POST /metadata/store # Store search metadata in D1 (user data)
GET  /metadata/query # Query metadata from D1 (user-specific queries)
POST /user/preferences # Store user preferences
GET  /user/preferences # Get user preferences
```

### Phase 2: Engine Workers (Week 3-4)

**2.1 Create Engine Worker Structure:**

```
api/engines/
├── google/
│   ├── src/index.ts       # Google Engine Worker with user context
│   ├── wrangler.toml
│   └── package.json
├── brave/
│   ├── src/index.ts       # Brave Engine Worker with user context
│   ├── wrangler.toml
│   └── package.json
├── serper/
│   ├── src/index.ts       # Serper Engine Worker with user context
│   ├── wrangler.toml
│   └── package.json
└── shared/
    ├── types/             # Including user context types
    └── utils/
```

**2.2 Engine Worker API with User Context:**

```typescript
// Each Engine Worker endpoints
POST /search           # Execute search with user context
GET  /health          # Health check
GET  /info            # Engine capabilities
POST /user/cache      # User-specific cache operations
```

**2.3 Migration Strategy:**

- Move `braveSearchEngine.ts` → `api/engines/brave/src/index.ts`, **add user context parameter**
- Move `googleSearchEngine.ts` → `api/engines/google/src/index.ts`, **add user context parameter**
- Move `serperSearchEngine.ts` → `api/engines/serper/src/index.ts`, **add user context parameter**
- Update each to call Storage Worker for caching, **user-specific caching**
- Remove engine-specific caching logic

### Phase 3: Orchestration Worker (Month 2)

**3.1 Create Orchestration Worker:**

```
api/orchestration/
├── src/
│   ├── index.ts           # Orchestration Worker entry with user context
│   ├── services/
│   │   ├── coordinator.ts # Multi-engine coordination with user preferences
│   │   ├── aggregator.ts  # Result aggregation with user personalization
│   │   └── paginator.ts   # Pagination normalization
│   ├── types/             # Including user context types
│   └── config/
├── wrangler.toml
└── package.json
```

**3.2 Orchestration Logic with User Context:**

- Extract coordination logic from `UnifiedSearchService`, **preserve user context**
- Implement parallel engine calls, **pass user context**
- Handle result aggregation and deduplication, **apply user preferences**
- Normalize pagination across engines

### Phase 4: Processing Worker (Month 2)

**4.1 Create Processing Worker:**

```
api/processors/
├── src/
│   ├── index.ts              # Processing Worker entry with user context
│   ├── services/
│   │   ├── deduplicator.ts   # Remove duplicate results
│   │   ├── keywordExtractor.ts # Extract keywords
│   │   ├── personalizer.ts   # User personalization logic
│   │   └── enhancer.ts       # Result enhancement
│   └── types/                # Including user context types
├── wrangler.toml
└── package.json
```

### Phase 5: API Gateway Refactor (Month 2)

**5.1 Slim Down API Gateway:**

- Keep only routing, **JWT validation**, auth, and request/response handling
- Remove all business logic
- Delegate to Orchestration Worker, **pass user context**

**5.2 Updated API Gateway with Authentication:**

```typescript
// api/routes/src/index.ts (slimmed down with auth)
app.get("/api/search/images", async (c) => {
  // 1. JWT already validated by middleware
  const payload = c.get("jwtPayload");

  // 2. Extract user context
  const userContext = {
    id: payload.sub,
    email: payload.email,
    permissions: payload.permissions,
    isAuthenticated: true,
    authProvider: "auth0",
  };

  // 3. Call Orchestration Worker with user context
  const result = await orchestrationWorker.search({
    query,
    user: userContext,
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
  });

  // 4. Return response with user context
  return c.json({
    ...result,
    user: payload.sub,
    searchedAt: new Date().toISOString(),
  });
});
```

## Inter-Worker Communication Plan with Authentication

**Communication Options:**

**Option A: HTTP Requests with User Context (Simple & Debuggable)**

```typescript
// Worker-to-Worker HTTP calls with user context
const response = await fetch(
  "https://storage-worker.your-domain.workers.dev/cache/get",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": userContext.id,
      "X-Request-ID": requestId,
    },
    body: JSON.stringify({
      key: "search_cache_key",
      user: userContext,
    }),
  }
);
```

**Option B: Durable Objects with User Context (Stateful & Efficient)**

```typescript
// Durable Objects for inter-worker communication with user context
export class StorageDurableObject {
  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    // Handle storage operations with state persistence
    // User context maintained throughout request
    const userContext = await extractUserContext(request);
    // Clear boundaries and contracts maintained
  }
}

// Usage from other Workers
const durableObjectId = env.STORAGE_DO.idFromName(`storage-${userContext.id}`);
const durableObject = env.STORAGE_DO.get(durableObjectId);
const response = await durableObject.fetch(request);
```

**Option C: Hybrid Approach with User Context**

- Use Durable Objects for stateful operations (caching, session management), **user-specific state**
- Use HTTP requests for stateless operations (search execution, processing)
- Maintain clear contracts and boundaries regardless of communication method
- **Consistent user context passing across all communication methods**

**Worker URLs (Development):**

```
API Gateway:    https://api-gateway.your-domain.workers.dev (JWT validation)
Orchestration:  https://orchestration.your-domain.workers.dev (user context coordination)
Storage:        https://storage.your-domain.workers.dev (user-specific storage)
Google Engine:  https://google-engine.your-domain.workers.dev (user-aware search)
Brave Engine:   https://brave-engine.your-domain.workers.dev (user-aware search)
Serper Engine:  https://serper-engine.your-domain.workers.dev (user-aware search)
Processing:     https://processing.your-domain.workers.dev (user personalization)
```

**Communication Flow with Authentication:**

1. User + JWT → API Gateway (validates JWT, extracts user context)
2. API Gateway → Orchestration Worker (HTTP or DO, **passes user context**)
3. Orchestration → Engine Workers (parallel HTTP calls, **includes user context**)
4. Orchestration → Processing Worker (HTTP or DO, **user personalization**)
5. All Workers → Storage Worker/DO (for caching, **user-specific operations**)

**Contract Enforcement:**

- TypeScript interfaces for all inter-worker communication, **including user context**
- Request/response validation, **user context validation**
- Error handling and retry logic
- Monitoring and logging across all communication methods, **user context tracking**

## Cost Optimization Strategy with User Context

**KV Usage (Free Tier: 1,000 writes/day, 100,000 reads/day):**

- Cache search results with 1-week TTL, **user-specific cache keys**
- Batch writes where possible
- Compress large payloads
- Use intelligent cache keys, **include user ID for personalization**

**D1 Usage (Free Tier: 100,000 reads/day, 100,000 writes/day):**

- Store search metadata and analytics, **user preferences and history**
- Track popular queries for suggestions
- Build searchable index of results, **user-specific data**

**Worker Requests (Free Tier: 100,000 requests/day per Worker):**

- Minimize cross-Worker calls
- Implement request batching
- Use local caching where appropriate
- Consider Durable Objects for reducing HTTP overhead, **user-specific state management**

**Durable Objects (Free Tier: 1,000,000 requests/month):**

- Use for stateful operations that benefit from persistence, **user sessions and preferences**
- Reduce HTTP overhead for frequent inter-worker communication
- Maintain clear boundaries even with shared state
- **User-specific Durable Object instances for personalization**

## Implementation Timeline with Authentication

**Week 1-2: Storage Foundation**

- [ ] Create Storage Worker or Durable Object, **user-specific storage patterns**
- [ ] Migrate CacheService to use KV, **add user-aware caching**
- [ ] Add D1 integration, **user preferences and history tables**
- [ ] Test with existing functionality, **preserve user context**

**Week 3-4: Engine Extraction**

- [ ] Create Brave Engine Worker, **add user context parameter**
- [ ] Create Google Engine Worker, **add user context parameter**
- [ ] Create Serper Engine Worker, **add user context parameter**
- [ ] Update UnifiedSearchService to call Workers, **pass user context**

**Month 2: Orchestration & Processing**

- [ ] Create Orchestration Worker, **preserve user context flow**
- [ ] Extract coordination logic, **apply user preferences**
- [ ] Create Processing Worker, **user personalization**
- [ ] Implement deduplication, **user behavior tracking**

**Month 2: API Gateway Refactor**

- [ ] Slim down API Gateway, **maintain JWT validation**
- [ ] Update routing to call Orchestration, **pass user context**
- [ ] Test end-to-end functionality, **preserve authentication**

## Risk Mitigation with Authentication

**Rollback Strategy:**

- Keep existing code until each phase is tested
- Feature flags for Worker vs. monolith mode
- Gradual traffic migration
- **Preserve JWT validation throughout migration**

**Testing Strategy:**

- Unit tests for each Worker, **including user context handling**
- Integration tests for Worker communication (HTTP and DO), **user context flow**
- Load testing for free tier limits
- **Authentication flow testing**

**Monitoring:**

- Request/response logging across Workers, **user context tracking**
- Performance metrics for both HTTP and DO communication
- Error tracking and alerting
- Cost monitoring for KV, D1, and DO usage
- **User authentication and authorization monitoring**
