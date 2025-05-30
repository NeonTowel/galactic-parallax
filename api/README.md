# Galactic Parallax API

A Hono.js-based API running on Cloudflare Workers that provides high-quality wallpaper search functionality using Google Custom Search API.

## Features

- **High-Quality Image Search**: Optimized for 2K+ wallpapers
- **Orientation Support**: Landscape and portrait wallpaper filtering
- **Smart Query Crafting**: Automatically enhances user queries for better results
- **JWT Authentication**: All search endpoints require Auth0 JWT tokens
- **Modular Architecture**: Well-structured, maintainable codebase
- **Secure by Design**: Fully authenticated API with user context tracking

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
- `count` (optional): Number of results (1-10, default: 10)
- `start` (optional): Starting index for pagination (default: 1)

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/images?q=mountain%20sunset&orientation=landscape&count=5"
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

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://parallax.apis.neontowel.dev/api/search/health"
```

## Setup

### 1. Google Custom Search API Setup

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
# Set your Google API credentials
wrangler secret put GOOGLE_SEARCH_API_KEY
wrangler secret put GOOGLE_SEARCH_ENGINE_ID

# Auth0 configuration (already set)
# AUTH0_DOMAIN and AUTH0_AUDIENCE are in wrangler.toml
```

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

The API automatically enhances user queries with:

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
- Count out of range (1-10)
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
