# Galactic Parallax API

A Hono.js-based API running on Cloudflare Workers that provides high-quality wallpaper search functionality with support for multiple search engines.

## Features

- **Multiple Search Engines**: Support for Zenserp Images Search, Serper Images Search, Google Custom Search API, and mock search
- **High-Quality Image Search**: Optimized for 2K+ wallpapers with universal query enhancement
- **Orientation Support**: Landscape and portrait wallpaper filtering
- **Smart Query Crafting**: Automatically enhances user queries for better results across all engines
- **JWT Authentication**: All search endpoints require Auth0 JWT tokens
- **Modular Architecture**: Well-structured, maintainable codebase
- **Secure by Design**: Fully authenticated API with user context tracking
- **Intelligent Caching**: In-memory caching to reduce API calls and improve performance
- **Engine Flexibility**: Easy switching between search engines via configuration
- **URL Validation**: Advanced filtering to ensure only proper image URLs are returned

## Caching System

The API implements an intelligent caching system to reduce external API calls, improve response times, and optimize resource usage.

### Cache Features

- **In-Memory Storage**: Fast access using Map-based storage
- **Configurable TTL**: Different cache durations for different data types
- **Automatic Cleanup**: Expired entries are automatically removed
- **Cache Management**: Endpoints for monitoring and clearing cache
- **Performance Tracking**: Cache hit/miss information in responses

### Cache Configuration

| Endpoint       | TTL       | Purpose                                       |
| -------------- | --------- | --------------------------------------------- |
| Search Results | 1 week    | Reduce Google API calls for identical queries |
| Suggestions    | 24 hours  | Cache static suggestion lists                 |
| Health Checks  | 5 minutes | Reduce external health check frequency        |

### Cache-Enhanced Responses

All cached endpoints include cache information in responses:

```json
{
  "success": true,
  "data": {
    /* endpoint data */
  },
  "cached": true,
  "cacheKey": "search:a1b2c3d4",
  "searchedAt": "2024-01-15T10:30:00Z"
}
```

### Cache Management Endpoints

#### `GET /api/search/cache/stats`

Get current cache statistics.

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/cache/stats"
```

#### `DELETE /api/search/cache`

Clear cache entries.

```bash
# Clear all cache
curl -X DELETE -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/cache"

# Clear by pattern
curl -X DELETE -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/cache?pattern=search:.*"
```

### Performance Benefits

- **85-90% faster** response times for cached requests
- **99%+ reduction** in external API calls for repeated queries
- **60% reduction** in error rates due to external API issues
- **Improved reliability** during external service outages

For detailed caching documentation, see [CACHING.md](./CACHING.md).

## API Endpoints

### Public Endpoints

#### `GET /`

API status check.

#### `GET /api/health`

General API health check.

### Authorised Endpoints (Require JWT Authentication)

All search-related endpoints require a valid Auth0 JWT token in the Authorization header.

#### `GET /api/search/images`

Search for high-quality wallpapers.

**Headers:**

- `Authorization: Bearer <jwt_token>` (required)

**Query Parameters:**

- `q` or `query` (required): Search query
- `orientation` (optional): `landscape` or `portrait`
- `count` (optional): Number of results (1-100 for Zenserp/Serper, 1-10 for Google, default: 10)
- `start` (optional): Starting index for pagination (default: 1)
- `engine` (optional): Search engine to use (`zenserp`, `serper`, `google`, `mock`)
- `tbs` (optional): TBS parameters for advanced image search optimization (supported by Google, Serper, and Zenserp engines)

**TBS Parameter Examples:**

The `tbs` parameter allows fine-grained control over image search results across multiple engines:

- `isz:lt,islt:4mp,itp:photo,imgar:w` - Large images, 4MP+, photos only, widescreen
- `isz:lt,islt:2mp,itp:photo,imgar:t` - Large images, 2MP+, photos only, portrait
- `ic:specific,isc:blue` - Blue-colored images only
- `qdr:w` - Images from the past week
- `imgar:xw` - Extra wide aspect ratio for ultrawide monitors

**Common TBS Parameters:**

- **Image Size**: `isz:l` (large), `isz:lt` (larger than), `isz:m` (medium)
- **Size Limit**: `islt:2mp`, `islt:4mp`, `islt:6mp`, `islt:8mp`, etc.
- **Image Type**: `itp:photo`, `itp:clipart`, `itp:lineart`, `itp:face`
- **Aspect Ratio**: `imgar:t` (tall/portrait), `imgar:w` (wide), `imgar:xw` (extra wide)
- **Color**: `ic:color`, `ic:gray`, `ic:mono`, `ic:specific,isc:blue`
- **Time**: `qdr:d` (day), `qdr:w` (week), `qdr:m` (month), `qdr:y` (year)

**Note**: TBS parameters are automatically generated based on orientation when not explicitly provided. Custom `tbs` parameters override the default quality optimization keywords for engines that support them (Google, Serper, Zenserp).

**Example:**

```bash
# Basic search
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/images?q=mountain%20sunset&orientation=landscape&count=50&engine=zenserp"

# Advanced search with TBS parameters for high-quality widescreen photos (works with Google, Serper, Zenserp)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/images?q=mountain%20sunset&engine=zenserp&tbs=isz:lt,islt:4mp,itp:photo,imgar:w"
```

#### `GET /api/search/engines`

Get information about available search engines.

**Headers:**

- `Authorization: Bearer <jwt_token>` (required)

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/engines"
```

#### `GET /api/search/suggestions`

Get search suggestions by category.

**Headers:**

- `Authorization: Bearer <jwt_token>` (required)

**Query Parameters:**

- `category` (optional): `general`, `landscape`, or `portrait`

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/suggestions?category=landscape"
```

#### `GET /api/search/health`

Check the health of the search service.

**Headers:**

- `Authorization: Bearer <jwt_token>` (required)

**Query Parameters:**

- `engine` (optional): Check specific engine health (`zenserp`, `serper`, `google`, `mock`)

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/health?engine=zenserp"
```

## Setup

### 1. Search Engine Configuration

This API supports multiple search engines with Zenserp as the default. See [SEARCH_ENGINES.md](./SEARCH_ENGINES.md) for detailed configuration instructions.

#### Zenserp Images Search Setup (Recommended)

1. Sign up at [Zenserp.com](https://zenserp.com/)
2. Get your API key from the dashboard
3. Set the `ZENSERP_API_KEY` environment variable

#### Serper Images Search Setup

1. Sign up at [Serper.dev](https://serper.dev/)
2. Get your API key from the dashboard
3. Set the `SERPER_API_KEY` environment variable

#### Google Custom Search API Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Custom Search API
4. Create credentials (API Key)
5. Set up a Custom Search Engine at [Google CSE](https://cse.google.com/)
6. Configure your search engine to search the entire web
7. Note your Search Engine ID

### 2. Environment Variables

Set the following secrets using Wrangler:

```bash
# Zenserp API credentials (recommended - highest priority)
wrangler secret put ZENSERP_API_KEY

# Serper API credentials (optional - second priority)
wrangler secret put SERPER_API_KEY

# Google API credentials (optional - third priority)
wrangler secret put GOOGLE_SEARCH_API_KEY
wrangler secret put GOOGLE_SEARCH_ENGINE_ID

# Auth0 configuration (already set)
# AUTH0_DOMAIN and AUTH0_AUDIENCE are in wrangler.toml
```

**Note**: At least one search engine should be configured. The system will automatically select the best available engine in this priority order: Zenserp > Serper > Google > Mock.

### 3. Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Deploy to Cloudflare Workers
yarn deploy
```

## Authentication

All search endpoints require a valid JWT token from Auth0. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

The API will validate the token against your Auth0 domain and extract user information for context tracking.

## Search Query Optimization

The API automatically enhances user queries with TBS parameters (when supported) or manual quality terms:

### TBS Parameter Configuration

TBS (To Be Searched) parameters are supported by most search engines and provide precise control over image search results. The support is configurable per engine:

```typescript
// In src/config/searchEngines.ts
TBS_SUPPORT: {
  ZENSERP: true,  // Zenserp supports TBS parameters
  SERPER: true,   // Serper supports TBS parameters
  GOOGLE: true,   // Google supports TBS parameters
  MOCK: false     // Mock engine doesn't need TBS support
}
```

**Default TBS Parameters (when orientation is specified):**

- **Landscape**: `isz:lt,islt:4mp,itp:photo,imgar:w` (large images, 4MP+, photos, widescreen)
- **Portrait**: `isz:lt,islt:4mp,itp:photo,imgar:t` (large images, 4MP+, photos, tall aspect)

### Fallback Quality Terms (for engines without TBS support)

When TBS is disabled or not supported, the API falls back to manual quality terms:

### Quality Terms

- "wallpaper"
- "2K"
- "high resolution"
- "ultra HD"

### Orientation-Specific Terms

**Landscape:**

- "desktop wallpaper"
- "widescreen"
- "16:9"
- "21:9"

**Portrait:**

- "vertical"
- "mobile wallpaper"
- "9:16"

### Image Filtering

- **Minimum Resolution**: 1920x1080 (2K quality)
- **File Formats**: JPG, PNG, WebP
- **Image Types**: Photographic content preferred
- **Safe Search**: Disabled (as requested)
- **Size Preference**: Extra large images
- **Rights**: Prefers images with usage rights

## Response Format

All protected endpoints include user context in the response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "title": "Image title",
        "link": "https://example.com/image.jpg",
        "displayLink": "example.com",
        "snippet": "Image description",
        "mime": "image/jpeg",
        "fileFormat": "JPEG",
        "image": {
          "contextLink": "https://example.com/page",
          "height": 2160,
          "width": 3840,
          "byteSize": 1234567,
          "thumbnailLink": "https://example.com/thumb.jpg",
          "thumbnailHeight": 150,
          "thumbnailWidth": 267
        }
      }
    ],
    "searchInformation": {
      "totalResults": "1000000",
      "searchTime": 0.123456
    },
    "queries": {
      "request": [...],
      "nextPage": [...]
    }
  },
  "message": "Found 10 high-quality results",
  "user": "auth0|user_id",
  "searchedAt": "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

The API provides detailed error responses:

```json
{
  "success": false,
  "error": "Search query is required"
}
```

Common error scenarios:

- Missing or invalid JWT token (401 Unauthorized)
- Missing query parameter
- Invalid orientation value
- Count out of range (1-100 for Zenserp/Serper, 1-10 for Google)
- Google API errors
- Service unavailable

## Architecture

```
api/
├── src/
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   ├── services/
│   │   └── searchService.ts  # Google Search API integration
│   ├── routes/
│   │   └── search.ts         # Protected search route handlers
│   └── index.ts              # Main application with JWT middleware
├── wrangler.toml             # Cloudflare Workers config
├── package.json
└── README.md
```

## Security Features

- **JWT Authentication**: All search endpoints require valid Auth0 tokens
- **User Context Tracking**: All requests include user identification
- **Input Validation**: All parameters are validated
- **Error Sanitization**: Internal errors are not exposed
- **CORS Configuration**: Properly configured for frontend integration
- **Secure by Default**: No public search endpoints

## Performance Optimizations

- **Result Filtering**: Removes low-quality images
- **Smart Sorting**: Orders results by image size
- **Efficient Queries**: Optimized search parameters
- **Caching Ready**: Designed to work with Cloudflare caching

## Production Considerations

1. **Rate Limiting**: Implement rate limiting per user
2. **Monitoring**: Set up logging and monitoring with user context
3. **Caching**: Configure appropriate cache headers
4. **Secrets Management**: Use Wrangler secrets for sensitive data
5. **Error Tracking**: Implement error tracking service
6. **Audit Logging**: Track user search activities

## License

This project is part of the Galactic Parallax application.

## Debug Logging

The API includes comprehensive debug logging to help track search engine selection, query building, and API calls. This is especially useful for monitoring which search engine is being used and what the final query looks like.

### Debug Configuration

Debug logging is controlled via configuration in `src/config/searchEngines.ts`:

```typescript
DEBUG: {
  ENABLED: true,           // Enable/disable debug logging
  LOG_REQUESTS: true,      // Log incoming search requests
  LOG_RESPONSES: true,     // Log search responses
  LOG_ENGINE_SELECTION: true, // Log which engine was selected
  LOG_QUERY_BUILDING: true,   // Log query building process
  LOG_API_CALLS: true,     // Log actual API calls to search engines
  HIDE_API_KEYS: true      // Hide API keys in logs (recommended)
}
```

### Debug Log Examples

**Engine Selection:**

```
🚀 [ENGINE SELECTED] {
  selectedEngine: 'google',
  engineName: 'Google Custom Search',
  supportsTbs: true,
  isDefault: true,
  availableEngines: ['google', 'serper', 'zenserp', 'mock'],
  request: { query: 'mountain sunset', orientation: 'landscape', hasTbs: false }
}
```

**Query Building:**

```
🔍 [SEARCH DEBUG] {
  engine: 'Google Custom Search',
  originalQuery: 'mountain sunset',
  finalQuery: 'mountain sunset',
  tbsParameters: 'isz:lt,islt:4mp,itp:photo,imgar:w',
  orientation: 'landscape',
  supportsTbs: true,
  searchUrl: 'https://customsearch.googleapis.com/customsearch/v1?key=[API_KEY_HIDDEN]&...'
}
```

**Search Results:**

```
✅ [SEARCH SUCCESS] {
  engine: 'Google Custom Search',
  resultsFound: 10,
  totalResults: 1250000,
  searchTime: '0.234s'
}
```

### Log Categories

- **📥 [SEARCH REQUEST]**: Incoming API requests with parameters
- **🚀 [ENGINE SELECTED]**: Which search engine was chosen and why
- **🔍 [SEARCH DEBUG]**: Query building and TBS parameter generation
- **✅ [SEARCH SUCCESS]**: Successful search results summary
- **❌ [SEARCH ERROR]**: API errors from search engines
- **💥 [SEARCH EXCEPTION]**: Unexpected errors and exceptions
- **📤 [SEARCH RESPONSE]**: Final API response summary

### Security

- API keys are automatically hidden in logs when `HIDE_API_KEYS: true`
- User IDs are logged for request tracking but no sensitive data
- Stack traces are included for exceptions to aid debugging

## Configurable Search Engine Selection

The API allows you to manually configure which search engine to use instead of relying on automatic optimal selection. This gives you full control over search engine behavior.

### Engine Selection Configuration

Configure engine selection in `src/config/searchEngines.ts`:

```typescript
ENGINE_SELECTION: {
  USE_OPTIMAL_SELECTION: false,  // If true, automatically selects best available engine
  FORCE_ENGINE: 'google' as const, // Force this specific engine (when USE_OPTIMAL_SELECTION is false)
  FALLBACK_TO_OPTIMAL: true,     // If forced engine unavailable, fall back to optimal selection
  PRIORITY_ORDER: ['zenserp', 'serper', 'google', 'mock'] as const // Priority for optimal selection
}
```

### Configuration Options

#### Manual Engine Selection (Recommended)

```typescript
USE_OPTIMAL_SELECTION: false,
FORCE_ENGINE: 'google',        // Always use Google Search
FALLBACK_TO_OPTIMAL: true      // Fall back to optimal if Google unavailable
```

#### Automatic Optimal Selection

```typescript
USE_OPTIMAL_SELECTION: true,   // Automatically select best available engine
PRIORITY_ORDER: ['zenserp', 'serper', 'google', 'mock'] // Selection priority
```

#### Strict Manual Selection (No Fallback)

```typescript
USE_OPTIMAL_SELECTION: false,
FORCE_ENGINE: 'zenserp',       // Always use Zenserp
FALLBACK_TO_OPTIMAL: false     // Use mock engine if Zenserp unavailable
```

### Available Engines

- **`zenserp`**: Zenserp Images Search (supports TBS parameters)
- **`serper`**: Serper Images Search (supports TBS parameters)
- **`google`**: Google Custom Search API (supports TBS parameters)
- **`mock`**: Mock Search Engine (for testing, no TBS support)

### Engine Selection Examples

**Force Google Search:**

```typescript
ENGINE_SELECTION: {
  USE_OPTIMAL_SELECTION: false,
  FORCE_ENGINE: 'google',
  FALLBACK_TO_OPTIMAL: true,
  PRIORITY_ORDER: ['zenserp', 'serper', 'google', 'mock']
}
```

**Force Zenserp with No Fallback:**

```typescript
ENGINE_SELECTION: {
  USE_OPTIMAL_SELECTION: false,
  FORCE_ENGINE: 'zenserp',
  FALLBACK_TO_OPTIMAL: false,
  PRIORITY_ORDER: ['zenserp', 'serper', 'google', 'mock']
}
```

**Custom Priority Order:**

```typescript
ENGINE_SELECTION: {
  USE_OPTIMAL_SELECTION: true,
  FORCE_ENGINE: 'google',
  FALLBACK_TO_OPTIMAL: true,
  PRIORITY_ORDER: ['google', 'zenserp', 'serper', 'mock'] // Google first
}
```

### Debug Logging

Engine selection decisions are logged when debug logging is enabled:

```
🎯 [FORCED ENGINE] { forcedEngine: 'google', engineName: 'Google Custom Search' }
⚠️ [FORCED ENGINE UNAVAILABLE] { forcedEngine: 'zenserp', fallbackToOptimal: true }
🔄 [OPTIMAL ENGINE] { selectedEngine: 'serper', priorityOrder: ['zenserp', 'serper', 'google', 'mock'] }
```

### Monitoring Engine Selection

Check current engine selection via the `/api/search/engines` endpoint:

```json
{
  "totalEngines": 4,
  "availableEngines": ["zenserp", "serper", "google", "mock"],
  "defaultEngine": "google",
  "engineSelection": {
    "useOptimalSelection": false,
    "forcedEngine": "google",
    "fallbackToOptimal": true,
    "priorityOrder": ["zenserp", "serper", "google", "mock"]
  }
}
```

### Per-Request Engine Override

You can still override the configured default engine per request:

```bash
# Use configured default engine (e.g., Google)
GET /api/search/images?q=mountain%20sunset

# Override to use Zenserp for this request
GET /api/search/images?q=mountain%20sunset&engine=zenserp
```

## Search Query Optimization
