# Search Engine Configuration

This API supports multiple search engines for image search functionality. The system automatically selects the best available engine based on your configuration.

## Supported Search Engines

### 1. Google Custom Search API

- **Engine Key**: `google`
- **Status**: Primary choice when configured
- **Required Environment Variables**:
  - `GOOGLE_SEARCH_API_KEY`
  - `GOOGLE_SEARCH_ENGINE_ID`

### 2. Serper Images Search API

- **Engine Key**: `serper`
- **Status**: Available but not enabled by default
- **Required Environment Variables**:
  - `SERPER_API_KEY`

### 3. Mock Search Engine

- **Engine Key**: `mock`
- **Status**: Always available as fallback
- **Purpose**: Testing and development

## Default Engine Selection

The system automatically selects the default engine in this priority order:

1. **Google Search** (if configured)
2. **Serper Search** (if configured)
3. **Mock Search** (fallback)

## Changing the Default Search Engine

### Method 1: Update Configuration File (Recommended)

Edit `src/config/searchEngines.ts`:

```typescript
export const SEARCH_ENGINE_CONFIG = {
  DEFAULT_ENGINE: "serper" as const, // Change this to 'google', 'serper', or 'mock'
  AVAILABLE_ENGINES: {
    GOOGLE: "google",
    SERPER: "serper",
    MOCK: "mock",
  } as const,
};
```

### Method 2: Runtime Engine Selection

You can specify which engine to use per request by adding the `engine` query parameter:

```
GET /api/search/images?q=nature&engine=serper
GET /api/search/images?q=nature&engine=google
GET /api/search/images?q=nature&engine=mock
```

## Environment Variables Setup

### For Google Search:

```bash
GOOGLE_SEARCH_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

### For Serper Search:

```bash
SERPER_API_KEY=your_serper_api_key_here
```

## API Endpoints

### Check Available Engines

```
GET /api/search/engines
```

### Health Check for Engines

```
GET /api/search/health
GET /api/search/health?engine=serper
```

### Search with Specific Engine

```
GET /api/search/images?q=query&engine=serper
```

## Implementation Notes

- The Serper search engine is implemented but **not enabled by default**
- To enable Serper, set the `SERPER_API_KEY` environment variable
- The system will automatically detect available engines and adjust accordingly
- All engines implement the same interface, ensuring consistent API responses
- Caching works across all search engines

## Serper API Integration

The Serper implementation:

- Uses the `/images` endpoint from `google.serper.dev`
- Supports orientation filtering (landscape/portrait)
- Handles pagination and result limiting
- Provides health check functionality
- Maps Serper response format to the unified API format

## Testing

You can test different engines using the health check endpoint:

```bash
# Check all engines
curl "https://your-api.com/api/search/health"

# Check specific engine
curl "https://your-api.com/api/search/health?engine=serper"
```
