# Pagination Testing Guide

This document demonstrates how pagination works correctly across different search engines with varying result set capabilities.

## Search Engine Capabilities

| Engine | Max Results Per API Call | Pagination Method                                       |
| ------ | ------------------------ | ------------------------------------------------------- |
| Google | 10 results               | API-level pagination (uses `start` parameter)           |
| Serper | 100 results              | Client-side pagination (fetch large set, slice locally) |
| Mock   | Variable                 | Simulated pagination                                    |

## Test Scenarios

### Scenario 1: Small Result Set (10 results requested)

**Request:**

```bash
GET /api/search/images?q=nature&count=10&start=1&engine=serper
```

**Expected Behavior:**

- Serper fetches 10 results from API
- Returns results 1-10
- Pagination shows: `currentPage: 1, totalResults: 10, hasNextPage: false`

### Scenario 2: Large Result Set with Pagination (100+ results available)

**Request Page 1:**

```bash
GET /api/search/images?q=nature&count=10&start=1&engine=serper
```

**Serper Behavior:**

- Fetches 100 results from API (max available)
- Filters by orientation if specified
- Returns results 1-10 from the filtered set
- Pagination: `currentPage: 1, totalResults: 85, totalPages: 9, hasNextPage: true`

**Request Page 2:**

```bash
GET /api/search/images?q=nature&count=10&start=11&engine=serper
```

**Serper Behavior:**

- Uses cached/refetched 100 results
- Returns results 11-20 from the filtered set
- Pagination: `currentPage: 2, totalResults: 85, totalPages: 9, hasNextPage: true`

### Scenario 3: Cross-Engine Consistency

**Google Engine (Page 1):**

```bash
GET /api/search/images?q=nature&count=10&start=1&engine=google
```

- Google API call: `start=1&num=10`
- Returns: 10 results
- Pagination: `currentPage: 1, totalResults: 1000000, hasNextPage: true`

**Google Engine (Page 2):**

```bash
GET /api/search/images?q=nature&count=10&start=11&engine=google
```

- Google API call: `start=11&num=10`
- Returns: 10 different results
- Pagination: `currentPage: 2, totalResults: 1000000, hasNextPage: true`

**Serper Engine (Page 1):**

```bash
GET /api/search/images?q=nature&count=10&start=1&engine=serper
```

- Serper API call: `num=100` (fetches ahead for pagination)
- Returns: results 1-10 from local slice
- Pagination: `currentPage: 1, totalResults: 100, hasNextPage: true`

**Serper Engine (Page 2):**

```bash
GET /api/search/images?q=nature&count=10&start=11&engine=serper
```

- Uses same 100 results (no new API call needed)
- Returns: results 11-20 from local slice
- Pagination: `currentPage: 2, totalResults: 100, hasNextPage: true`

## Key Improvements Made

### 1. Fixed Serper Pagination Logic

**Before (Incorrect):**

```typescript
const totalResults = results.length; // ❌ Wrong! This was filtered results count
const currentPage = Math.floor((request.start || 0) / resultsPerPage) + 1; // ❌ Wrong calculation
```

**After (Correct):**

```typescript
const totalAvailableResults = filteredResults.length; // ✅ Total after filtering
const currentPage = Math.ceil(startIndex / resultsPerPage); // ✅ Correct calculation
```

### 2. Proper Result Slicing

**Before:**

- No slicing - returned all results regardless of pagination parameters

**After:**

```typescript
const startSliceIndex = startIndex - 1; // Convert to 0-based
const endSliceIndex = startSliceIndex + resultsPerPage;
const pageResults = filteredResults.slice(startSliceIndex, endSliceIndex);
```

### 3. Smart Fetching Strategy

**Serper Engine:**

- Calculates minimum results needed: `startIndex + requestedCount - 1`
- Fetches up to 100 results to enable efficient pagination
- Avoids unnecessary API calls for subsequent pages

### 4. Consistent Validation

**Added to Serper:**

- Query validation (required, max length)
- Count validation (1-100 for Serper vs 1-10 for Google)
- Start index validation
- Orientation validation

## Response Format Consistency

Both engines now return identical pagination structure:

```json
{
  "success": true,
  "data": {
    "results": [...],
    "pagination": {
      "currentPage": 2,
      "totalResults": 85,
      "resultsPerPage": 10,
      "totalPages": 9,
      "hasNextPage": true,
      "hasPreviousPage": true,
      "nextStartIndex": 21,
      "previousStartIndex": 1
    },
    "searchInfo": {
      "query": "nature",
      "orientation": "landscape",
      "searchTime": 245,
      "searchEngine": "Serper Images Search (serper)",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

## Testing Commands

### Test Serper Pagination

```bash
# Page 1
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=1&engine=serper"

# Page 2
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=11&engine=serper"

# Page 3
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=21&engine=serper"
```

### Test Google Pagination

```bash
# Page 1
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=1&engine=google"

# Page 2
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=mountains&count=10&start=11&engine=google"
```

### Test Large Count with Serper

```bash
# Request 50 results at once
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=nature&count=50&start=1&engine=serper"

# Request next 50 results
curl -H "Authorization: Bearer TOKEN" \
  "https://api.example.com/api/search/images?q=nature&count=50&start=51&engine=serper"
```

## Performance Benefits

1. **Serper Engine**: Fetches 100 results once, serves multiple pages without additional API calls
2. **Google Engine**: Makes targeted API calls for each page (API limitation)
3. **Consistent UX**: Both engines provide identical pagination experience to frontend
4. **Efficient Caching**: Pagination parameters included in cache keys for proper cache segmentation
