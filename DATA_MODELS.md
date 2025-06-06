# Data Models for Wallpaper Index & Keyword System

Based on the layered monolith architecture and the goal of building a comprehensive wallpaper index, here are the data models we could implement:

## 1. Authentication & User Context

### A. JWT Payload Structure (Auth0)

```typescript
interface JWTPayload {
  sub: string; // User ID (Auth0 subject)
  permissions?: string[]; // Optional permissions array
  email?: string; // User email (if included in token)
  name?: string; // User display name
  picture?: string; // User avatar URL
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
  aud: string; // Audience (API identifier)
  iss: string; // Issuer (Auth0 domain)
  [key: string]: any; // Additional Auth0 claims
}
```

### B. User Context in Workers

```typescript
interface UserContext {
  id: string; // User ID from JWT sub claim
  email?: string; // User email
  permissions?: string[]; // User permissions
  isAuthenticated: boolean;
  authProvider: "auth0";
}

interface AuthenticatedRequest {
  user: UserContext;
  requestId: string;
  timestamp: string;
  // ... other request data
}
```

## 2. Core Data Models

### A. Search Results Storage (KV)

```typescript
// KV Key: search_cache:{hash}
interface CachedSearchResult {
  query: string;
  engine: string;
  orientation?: "landscape" | "portrait";
  results: WallpaperResult[];
  totalResults: number;
  searchTime: number;
  cachedAt: string;
  expiresAt: string;
  metadata: {
    userId: string; // User ID from JWT
    requestId: string;
    engineVersion: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

interface WallpaperResult {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  description: string;
  width: number;
  height: number;
  aspectRatio: number;
  fileSize?: number;
  mimeType: string;
  fileFormat: string;
  extractedKeywords?: string[];
  colorPalette?: string[];
  dominantColor?: string;
}
```

### B. Wallpaper Index (D1 SQL)

```sql
-- Main wallpapers table
CREATE TABLE wallpapers (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  thumbnail_url TEXT,
  source_url TEXT,
  source_domain TEXT,
  title TEXT,
  description TEXT,
  width INTEGER,
  height INTEGER,
  aspect_ratio REAL,
  file_size INTEGER,
  mime_type TEXT,
  file_format TEXT,
  dominant_color TEXT,
  color_palette TEXT, -- JSON array of colors
  quality_score REAL DEFAULT 0.0,
  popularity_score REAL DEFAULT 0.0,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  seen_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keywords table
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT UNIQUE NOT NULL,
  category TEXT, -- 'color', 'object', 'style', 'mood', etc.
  frequency INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship between wallpapers and keywords
CREATE TABLE wallpaper_keywords (
  wallpaper_id TEXT,
  keyword_id INTEGER,
  confidence REAL DEFAULT 1.0, -- AI confidence score
  source TEXT, -- 'extracted', 'manual', 'user_tag'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wallpaper_id, keyword_id),
  FOREIGN KEY (wallpaper_id) REFERENCES wallpapers(id),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

-- Search queries tracking with user context
CREATE TABLE search_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  normalized_query TEXT, -- lowercase, trimmed
  user_id TEXT NOT NULL, -- User ID from JWT
  engine TEXT,
  orientation TEXT,
  results_count INTEGER,
  search_time_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Popular queries for suggestions
CREATE TABLE popular_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT UNIQUE NOT NULL,
  search_count INTEGER DEFAULT 1,
  unique_users INTEGER DEFAULT 1, -- Count of unique users who searched this
  last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  category TEXT, -- 'trending', 'popular', 'seasonal'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### C. User Preferences & Analytics (D1 SQL)

```sql
-- User search preferences
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY, -- Auth0 user ID
  email TEXT,
  display_name TEXT,
  preferred_orientation TEXT,
  preferred_resolution TEXT, -- 'high', 'medium', 'any'
  preferred_engines TEXT, -- JSON array of engine preferences
  blocked_domains TEXT, -- JSON array of blocked domains
  favorite_keywords TEXT, -- JSON array of frequently used keywords
  search_history_enabled BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User search history
CREATE TABLE user_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  engine TEXT,
  orientation TEXT,
  results_count INTEGER,
  clicked_results TEXT, -- JSON array of clicked result IDs
  search_duration_ms INTEGER, -- Time spent on search results
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_preferences(user_id)
);

-- User favorites/bookmarks
CREATE TABLE user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  wallpaper_id TEXT NOT NULL,
  tags TEXT, -- JSON array of user-defined tags
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_preferences(user_id),
  FOREIGN KEY (wallpaper_id) REFERENCES wallpapers(id),
  UNIQUE(user_id, wallpaper_id)
);

-- Search analytics with user segmentation
CREATE TABLE search_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  total_searches INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  authenticated_searches INTEGER DEFAULT 0,
  anonymous_searches INTEGER DEFAULT 0,
  cache_hit_rate REAL DEFAULT 0.0,
  avg_search_time_ms REAL DEFAULT 0.0,
  top_keywords TEXT, -- JSON array of top keywords
  engine_usage TEXT, -- JSON object with engine usage stats
  user_retention_rate REAL DEFAULT 0.0, -- Daily/weekly retention
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for analytics
CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  searches_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (user_id) REFERENCES user_preferences(user_id)
);
```

## 3. Authentication Flow Data Models

### A. Request Context Models

```typescript
// API Gateway Request Context
interface APIGatewayContext {
  user: UserContext;
  request: {
    id: string;
    timestamp: string;
    userAgent?: string;
    ipAddress?: string;
    origin?: string;
  };
  auth: {
    token: string;
    payload: JWTPayload;
    validatedAt: string;
  };
}

// Worker Request Context (passed between workers)
interface WorkerRequestContext {
  user: {
    id: string;
    email?: string;
    permissions?: string[];
  };
  request: {
    id: string;
    timestamp: string;
    parentRequestId?: string; // For tracing across workers
  };
  metadata: {
    source:
      | "api-gateway"
      | "orchestration"
      | "engine"
      | "processing"
      | "storage";
    version: string;
  };
}
```

### B. Cache Key Strategies with User Context

```typescript
interface CacheKeyStrategy {
  // User-specific cache keys
  userSpecific: {
    searchResults: `user:${userId}:search:${queryHash}`;
    preferences: `user:${userId}:preferences`;
    favorites: `user:${userId}:favorites`;
    history: `user:${userId}:history:${date}`;
  };

  // Global cache keys
  global: {
    popularQueries: `global:popular:${category}`;
    suggestions: `global:suggestions:${category}`;
    wallpaperIndex: `global:wallpaper:${wallpaperId}`;
    keywords: `global:keywords:${category}`;
  };

  // Engine-specific cache keys
  engine: {
    results: `engine:${engineName}:${queryHash}`;
    health: `engine:${engineName}:health`;
    capabilities: `engine:${engineName}:info`;
  };
}
```

## 4. User-Centric Search Enhancement

### A. Personalized Search Models

```typescript
interface PersonalizedSearchRequest {
  query: string;
  user: UserContext;
  preferences: {
    orientation?: "landscape" | "portrait";
    resolution?: "high" | "medium" | "any";
    preferredEngines?: string[];
    blockedDomains?: string[];
    favoriteKeywords?: string[];
  };
  history: {
    recentQueries: string[];
    clickedResults: string[];
    searchPatterns: SearchPattern[];
  };
}

interface SearchPattern {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek: string;
  commonKeywords: string[];
  preferredOrientation: "landscape" | "portrait";
  avgSessionDuration: number;
}
```

### B. User Analytics Models

```typescript
interface UserAnalytics {
  userId: string;
  searchBehavior: {
    totalSearches: number;
    avgSearchesPerSession: number;
    mostActiveTimeOfDay: string;
    preferredKeywords: string[];
    clickThroughRate: number;
  };
  preferences: {
    orientationDistribution: Record<string, number>;
    engineUsage: Record<string, number>;
    categoryPreferences: Record<string, number>;
  };
  engagement: {
    sessionDuration: number;
    returnVisits: number;
    favoritesCount: number;
    lastActiveDate: string;
  };
}
```

## 5. Privacy & Data Protection

### A. Data Retention Policies

```typescript
interface DataRetentionPolicy {
  searchQueries: {
    retentionPeriod: "90 days";
    anonymizeAfter: "30 days"; // Remove user ID, keep aggregated data
    deleteAfter: "90 days";
  };
  userSessions: {
    retentionPeriod: "30 days";
    anonymizeAfter: "7 days";
  };
  cacheData: {
    userSpecific: "7 days";
    global: "30 days";
    engineResults: "24 hours";
  };
  userPreferences: {
    retentionPeriod: "until user deletion";
    backupRetention: "30 days after deletion";
  };
}
```

### B. User Data Export Models

```typescript
interface UserDataExport {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  searchHistory: SearchQuery[];
  preferences: UserPreferences;
  favorites: UserFavorite[];
  analytics: UserAnalytics;
  exportedAt: string;
  format: "json" | "csv";
}
```

## 6. Implementation Priority with Authentication

### Phase 1: Foundation (Week 1-2)

- Basic wallpaper storage in D1 with user tracking
- User preferences table and basic JWT integration
- User-specific cache keys in KV
- Search queries tracking with user context

### Phase 2: Enhancement (Week 3-4)

- User search history and favorites
- Personalized search suggestions
- User analytics and session tracking
- Privacy controls and data retention

### Phase 3: Intelligence (Month 2)

- Advanced user behavior analysis
- Personalized search results ranking
- User segmentation for A/B testing
- Cross-user recommendation engine

### Phase 4: Optimization (Month 3+)

- Machine learning for user preference prediction
- Advanced privacy features (data export, deletion)
- User engagement optimization
- Personalized wallpaper discovery

This enhanced data model design provides comprehensive user context integration while maintaining privacy and supporting the layered monolith architecture with proper authentication flow.

---

# Data Model Flow: Engine → Intermediary → UI (with Authentication)

## Data Model Flow: Engine → Intermediary → UI (with Authentication)

### 1. Engine-Specific Models (Input) - Enhanced with User Context

Each engine returns its own format, now enhanced with user context:

```typescript
// Enhanced Engine Request (includes user context)
interface AuthenticatedEngineRequest {
  query: string;
  orientation?: "landscape" | "portrait";
  user: UserContext;
  preferences?: UserPreferences;
  requestId: string;
  timestamp: string;
}

// Brave API returns this format (unchanged)
interface BraveSearchResponse {
  results: BraveImageResult[];
  // ... other Brave-specific fields
}

// Enhanced with user tracking
interface BraveImageResult {
  title: string;
  url: string;
  thumbnail: { src: string };
  properties: { url: string };
  source: string;
  // ... Brave-specific fields
  // Added for user tracking
  discoveredBy?: string; // User ID who first found this result
  userInteractions?: UserInteraction[];
}
```

### 2. Intermediary Models (Internal Processing) - Enhanced with User Context

Each engine converts to a unified internal format with user context:

```typescript
// Enhanced intermediary format with user context
interface AuthenticatedIntermediarySearchResponse {
  results: IntermediarySearchResult[];
  pagination: IntermediaryPaginationInfo;
  searchInfo: IntermediarySearchInfo;
  userContext: {
    userId: string;
    preferences: UserPreferences;
    searchHistory: RecentSearch[];
    personalizationApplied: boolean;
  };
}

interface IntermediarySearchResult {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  description: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType: string;
  fileFormat: string;
  // Enhanced with user-specific data
  personalityScore?: number; // How well this matches user preferences
  userInteractions?: {
    viewCount: number;
    favoriteCount: number;
    clickThroughRate: number;
  };
  isUserFavorite?: boolean;
  userTags?: string[];
}
```

### 3. UI-Facing Models (Output) - Enhanced with User Context

The final API response to the frontend with full user context:

```typescript
// Enhanced UI response with user context
interface AuthenticatedSearchResponse {
  success: boolean;
  data?: {
    results: SearchResult[]; // Enhanced UI-facing model
    pagination: PaginationInfo;
    searchInfo: SearchMetadata;
    userContext: UIUserContext; // User-specific UI data
  };
  error?: string;
  user: string; // User ID
  searchedAt: string;
  cached: boolean;
  cacheKey?: string;
  personalized: boolean; // Whether results were personalized
}

// Enhanced UI-facing result model with user context
interface SearchResult {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  description: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType: string;
  fileFormat: string;
  aspectRatio: number;
  isHighRes: boolean;
  loadingState?: "pending" | "loaded" | "error";
  // User-specific UI enhancements
  isFavorite: boolean;
  userRating?: number;
  userTags: string[];
  personalityScore: number; // 0-1 relevance to user preferences
  similarToFavorites: boolean;
  recommendationReason?: string; // "Similar to your favorites", "Trending in your style"
}

interface UIUserContext {
  preferences: {
    orientation: "landscape" | "portrait" | "any";
    preferredEngines: string[];
    blockedDomains: string[];
  };
  stats: {
    totalSearches: number;
    favoritesCount: number;
    recentQueries: string[];
  };
  recommendations: {
    suggestedQueries: string[];
    trendingInYourStyle: string[];
  };
}
```

## Current Implementation Analysis with Authentication

Looking at your current code with authentication context:

### Engine Layer (converts engine-specific → intermediary) - With User Context

```typescript
// Enhanced engine implementation with user context
async search(request: AuthenticatedEngineRequest): Promise<ApiResponse<AuthenticatedIntermediarySearchResponse>> {
  // 1. Call external API (gets BraveSearchResponse)
  const braveResponse: BraveSearchResponse = await fetch(...)

  // 2. Convert to intermediary format with user context
  const results: IntermediarySearchResult[] = braveResponse.results.map((item, index) => ({
    id: `brave_${index}`,
    title: item.title,
    url: item.properties.url,
    thumbnailUrl: item.thumbnail.src,
    // ... conversion logic

    // Enhanced with user-specific data
    personalityScore: calculatePersonalityScore(item, request.user.preferences),
    isUserFavorite: await checkUserFavorite(item.properties.url, request.user.id),
    userTags: await getUserTags(item.properties.url, request.user.id),
  }));

  // 3. Return intermediary format with user context
  return {
    success: true,
    data: {
      results,
      pagination,
      searchInfo,
      userContext: {
        userId: request.user.id,
        preferences: request.preferences,
        searchHistory: await getRecentSearches(request.user.id),
        personalizationApplied: true
      }
    }
  };
}
```

### Orchestration Layer (processes intermediary → UI-ready) - With User Context

```typescript
// Enhanced orchestration with user context
async search(request: AuthenticatedEngineRequest): Promise<ApiResponse<AuthenticatedIntermediarySearchResponse>> {
  // 1. Get user preferences and history
  const userPreferences = await getUserPreferences(request.user.id);
  const searchHistory = await getSearchHistory(request.user.id);

  // 2. Call engine with enhanced context
  const engineResult = await engine.search({
    ...request,
    preferences: userPreferences
  });

  // 3. Apply user-specific processing
  if (engineResult.success && engineResult.data) {
    // Personalize results based on user history
    engineResult.data.results = await personalizeResults(
      engineResult.data.results,
      userPreferences,
      searchHistory
    );

    // Track search for future personalization
    await trackSearch(request.user.id, request.query, engineResult.data.results);
  }

  return engineResult;
}
```

### API Gateway (adds metadata → final UI response) - With User Context

```typescript
// Enhanced API Gateway with full user context
app.get("/api/search/images", async (c) => {
  const payload = c.get("jwtPayload"); // JWT payload from middleware

  // 1. Build authenticated request
  const authenticatedRequest: AuthenticatedEngineRequest = {
    query,
    orientation,
    user: {
      id: payload.sub,
      email: payload.email,
      permissions: payload.permissions,
      isAuthenticated: true,
      authProvider: "auth0",
    },
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
  };

  // 2. Call orchestration with user context
  const result = await searchService.search(authenticatedRequest, engine);

  // 3. Add UI-specific user context
  const uiUserContext = await buildUIUserContext(payload.sub);

  // 4. Return enhanced response
  return c.json({
    ...result,
    user: payload.sub,
    searchedAt: new Date().toISOString(),
    cached: fromCache,
    cacheKey: fromCache ? cacheKey : undefined,
    personalized: true,
    userContext: uiUserContext,
  });
});
```

## Enhanced Benefits with Authentication:

1. **User-Specific Caching**: Cache results per user for personalized experiences
2. **Search History**: Track and learn from user behavior
3. **Personalized Results**: Rank results based on user preferences
4. **Favorites & Tags**: Allow users to save and organize wallpapers
5. **Privacy Controls**: User-controlled data retention and export
6. **Analytics**: User segmentation and behavior analysis
7. **Recommendations**: Suggest content based on user patterns

The authentication integration transforms the data flow from anonymous search to personalized, user-centric wallpaper discovery while maintaining clean layer separation and type safety throughout the system.
