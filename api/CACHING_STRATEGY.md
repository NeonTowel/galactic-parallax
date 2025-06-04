# Advanced Caching Strategy for Multi-Engine Search

This document explains the sophisticated caching strategy implemented to optimize performance across different search engines with varying capabilities.

## Overview

The API implements **engine-specific caching strategies** to maximize efficiency:

- **Google Engine**: Traditional per-page caching (API limitation)
- **Serper Engine**: Two-level caching for optimal pagination
- **Mock Engine**: Standard caching for consistency

## Caching Architecture

### Level 1: Main Response Cache (CacheService)

- **Purpose**: Caches final API responses
- **TTL**: 1 week
- **Key Strategy**: Engine-specific (see below)

### Level 2: Raw Results Cache (Serper Only)

- **Purpose**: Caches unprocessed result sets for pagination
- **TTL**: 1 week
- **Location**: In-memory within SerperSearchEngine
- **Key Strategy**: Query + Orientation only

## Engine-Specific Cache Key Strategies

### Google Engine Cache Keys

```typescript
// Each page gets its own cache entry
"search:abc123"; // q=nature&count=10&start=1&engine=google
"search:def456"; // q=nature&count=10&start=11&engine=google
"search:ghi789"; // q=nature&count=10&start=21&engine=google
```

**Rationale**: Google API returns max 10 results per call, so each page requires a separate API request.

### Serper Engine Cache Keys

```typescript
// Main cache (ignores pagination parameters)
"search:xyz999"; // q=nature&orientation=landscape&engine=serper
// ↑ Same key for ALL pages of the same query+orientation

// Raw results cache (internal to SerperSearchEngine)
"serper_raw:nature:landscape"; // Raw 100-result dataset
```

**Rationale**: Serper can return 100 results in one call, so we cache the full dataset and paginate locally.

## Serper Two-Level Caching Flow

### First Request (Cache Miss)

```bash
GET /api/search/images?q=nature&count=10&start=1&engine=serper
```

**Flow:**

1. Check main cache: `search:xyz999` → **MISS**
2. Check raw cache: `serper_raw:nature:any` → **MISS**
3. **API Call**: Fetch 100 results from Serper
4. Store in raw cache: Full 100 results
5. Generate page 1 (results 1-10)
6. Store in main cache: Paginated response
7. Return to client

### Second Request (Partial Cache Hit)

```bash
GET /api/search/images?q=nature&count=10&start=11&engine=serper
```

**Flow:**

1. Check main cache: `search:xyz999` → **HIT** (same key!)
2. Return cached response immediately
3. **No API call needed**

### Alternative Flow (Raw Cache Hit)

If main cache expires but raw cache is still valid:

```bash
GET /api/search/images?q=nature&count=20&start=21&engine=serper
```

**Flow:**

1. Check main cache: `search:xyz999` → **MISS** (different count)
2. Check raw cache: `serper_raw:nature:any` → **HIT**
3. Generate page from cached raw results (results 21-40)
4. Store new paginated response in main cache
5. **No API call needed**

## Performance Benefits

### API Call Reduction

| Scenario               | Google Engine   | Serper Engine (Old) | Serper Engine (New)        |
| ---------------------- | --------------- | ------------------- | -------------------------- |
| 10 pages of 10 results | 10 API calls    | 10 API calls        | **1 API call**             |
| Different page sizes   | 1 call per page | 1 call per page     | **1 call total**           |
| Mixed orientations     | 1 call per page | 1 call per page     | **1 call per orientation** |

### Cache Efficiency

```bash
# These requests share the SAME cache entry with new strategy:
GET /api/search/images?q=nature&count=10&start=1&engine=serper
GET /api/search/images?q=nature&count=10&start=11&engine=serper
GET /api/search/images?q=nature&count=10&start=21&engine=serper
GET /api/search/images?q=nature&count=20&start=1&engine=serper
GET /api/search/images?q=nature&count=5&start=50&engine=serper
```

## Implementation Details

### Cache Key Generation Logic

```typescript
// In CacheService.createSearchCacheKey()
if (engine === "serper") {
  // Serper: Ignore pagination parameters
  return generateCacheKey({
    prefix: "search",
    params: {
      query: request.query.toLowerCase().trim(),
      orientation: request.orientation || "any",
      engine: "serper",
      // Note: count and start deliberately excluded
    },
  });
} else {
  // Google/Mock: Include all parameters
  return generateCacheKey({
    prefix: "search",
    params: {
      query: request.query.toLowerCase().trim(),
      orientation: request.orientation || "any",
      count: request.count || 10,
      start: request.start || 1,
      engine: engine,
    },
  });
}
```

### Raw Results Caching (Serper)

```typescript
// Internal cache within SerperSearchEngine
private static rawResultsCache = new Map<string, SerperCachedResults>();

interface SerperCachedResults {
  allResults: IntermediarySearchResult[];  // Full 100 results
  totalResults: number;
  query: string;
  orientation?: 'landscape' | 'portrait';
  fetchedAt: string;
  searchTime: number;
}
```

## Cache Invalidation

### Automatic Expiration

- **Main Cache**: 1 week TTL
- **Raw Cache**: 1 week TTL
- **Cleanup**: Automatic when cache size exceeds limits

### Manual Invalidation

```bash
# Clear all search cache
DELETE /api/search/cache

# Clear specific patterns
DELETE /api/search/cache?pattern=search:.*serper.*
```

## Monitoring and Debugging

### Cache Statistics

```bash
GET /api/search/cache/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "size": 25,
    "keys": [
      "search:abc123",
      "search:xyz999",
      "suggestions:landscape",
      "health:search-service"
    ]
  }
}
```

### Cache Hit Indicators

All responses include cache information:

```json
{
  "success": true,
  "data": {
    /* results */
  },
  "cached": true,
  "cacheKey": "search:xyz999",
  "searchedAt": "2024-01-15T10:30:00Z"
}
```

## Testing Cache Behavior

### Test Serper Caching

```bash
# First request - should be slow (API call)
time curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=1&engine=serper"

# Second request - should be fast (cache hit)
time curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=11&engine=serper"

# Third request - should be fast (cache hit)
time curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=20&start=21&engine=serper"
```

### Expected Results

- **First request**: ~200-500ms (includes API call)
- **Subsequent requests**: ~10-50ms (cache hits)
- **Cache hit ratio**: 90%+ for typical usage patterns

## Edge Cases Handled

1. **Orientation Changes**: Separate cache entries for landscape/portrait
2. **Large Page Requests**: Efficiently served from 100-result cache
3. **Cache Expiration**: Graceful fallback to API calls
4. **Memory Management**: Automatic cleanup of expired entries
5. **Error Handling**: Cache failures don't break API functionality

## Future Optimizations

1. **Persistent Cache**: Move from in-memory to Redis/KV storage
2. **Predictive Caching**: Pre-fetch likely next pages
3. **Compression**: Compress cached results to save memory
4. **Analytics**: Track cache hit rates and optimize TTL values
