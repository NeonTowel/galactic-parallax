# Galactic Parallax API - Architectural Design Plan

## Comprehensive Architectural Design Requirements

### Core Requirements:

1. **Unified Pagination**: Consistent pagination experience regardless of underlying search engine capabilities
2. **Multi-Engine Support**: Ability to call multiple search engines for a single user query
3. **Performance**: Sub-100ms response times for cached results
4. **Cost Efficiency**: Stay within CloudFlare free tier limits
5. **Scalability**: Handle growing user base and additional search engines
6. **Backward Compatibility**: Existing UI pagination must continue working

### Technical Constraints:

1. **CloudFlare KV Free Tier**: 1,000 writes/day, 100,000 reads/day, 1GB storage
2. **Mixed Engine Capabilities**:
   - Google: 10 results max, supports pagination
   - Serper/Brave: ~100 results, no pagination
   - Future engines: Up to 300+ results, unknown pagination support
3. **Search Result Enhancement**: Extract keywords per result
4. **Result Deduplication**: Handle duplicate URLs across engines
5. **Cache Management**: Intelligent TTL and eviction strategies

### Current Architecture Analysis:

**What We Have:**

- ✅ Clean search engine abstraction
- ✅ Unified response format (`IntermediarySearchResponse`)
- ✅ Type-safe TypeScript implementation
- ✅ Basic caching (Serper only)
- ✅ Engine selection logic

**What's Missing:**

- ❌ Consistent caching across all engines
- ❌ Multi-engine coordination
- ❌ KV storage integration
- ❌ Result aggregation and deduplication
- ❌ Keyword extraction
- ❌ Efficient pagination for bulk-fetch engines

## Architectural Complexity Assessment

### Current Trajectory (Monolithic Approach):

```typescript
// Single API handling everything
class MonolithicSearchAPI {
  // 🔴 CONCERNS:
  - MultiEngineSearchCoordinator     // Complex orchestration
  - OptimizedKVStorage              // Complex caching logic
  - UnifiedPaginationService        // Complex pagination facade
  - ResultAggregationService        // Complex merging logic
  - KeywordExtractionService        // Additional processing
  - DeduplicationService            // Complex matching logic
  - CacheOptimizationService        // Complex TTL management

  // Single point of failure
  // Hard to test individual components
  // Difficult to scale specific features
  // Complex deployment and rollback
}
```

### Modular Approach Options:

#### Option A: Microservices Architecture

```typescript
// Separate Workers for different concerns
SearchGatewayWorker {
  // Routes requests to appropriate services
  // Handles authentication and rate limiting
  // Aggregates responses
}

SearchEngineWorker {
  // Handles individual engine requests
  // Engine-specific caching
  // One worker per engine or shared
}

ResultProcessingWorker {
  // Keyword extraction
  // Deduplication
  // Result enhancement
}

CacheManagerWorker {
  // KV storage operations
  // Cache optimization
  // TTL management
}

PaginationWorker {
  // Pagination logic
  // Result slicing
  // Metadata management
}
```

#### Option B: Layered Monolith with Clear Boundaries

```typescript
// Single API with well-defined internal modules
SearchAPI {
  // Clear separation of concerns
  // Dependency injection
  // Testable modules
  // Shared infrastructure

  modules: {
    EngineLayer,      // Search engine abstraction
    CacheLayer,       // KV storage operations
    ProcessingLayer,  // Result enhancement
    PaginationLayer,  // Pagination logic
    OrchestrationLayer // Multi-engine coordination
  }
}
```

#### Option C: Hybrid Architecture

```typescript
// Core API + Specialized Workers
CoreSearchAPI {
  // Basic search functionality
  // Single engine requests
  // Simple caching
}

MultiEngineOrchestrator {
  // Separate worker for multi-engine coordination
  // Calls CoreSearchAPI multiple times
  // Handles result aggregation
}

ResultEnhancementWorker {
  // Background processing
  // Keyword extraction
  // Deduplication
  // Triggered by queue
}
```

## Decision Matrix: Architecture Evaluation

| Aspect                       | Monolithic | Microservices | Layered Monolith | Hybrid    |
| ---------------------------- | ---------- | ------------- | ---------------- | --------- |
| **Development Speed**        | 🟡 Medium  | 🔴 Slow       | 🟢 Fast          | 🟡 Medium |
| **Testing Complexity**       | 🔴 High    | 🟢 Low        | 🟡 Medium        | 🟡 Medium |
| **Deployment Complexity**    | 🟢 Low     | 🔴 High       | 🟢 Low           | 🟡 Medium |
| **Scalability**              | 🔴 Poor    | 🟢 Excellent  | 🟡 Good          | 🟢 Good   |
| **CloudFlare KV Efficiency** | 🔴 Poor    | 🟡 Medium     | 🟢 Good          | 🟢 Good   |
| **Debugging**                | 🔴 Hard    | 🟡 Medium     | 🟢 Easy          | 🟡 Medium |
| **Resource Usage**           | 🔴 High    | 🟡 Medium     | 🟢 Low           | 🟡 Medium |
| **Future Flexibility**       | 🔴 Poor    | 🟢 Excellent  | 🟡 Good          | 🟢 Good   |

## Recommended Architecture: Hybrid Approach

### Phase 1: Enhanced Layered Monolith

```typescript
// api/src/architecture/
SearchAPI {
  // Well-defined layers with clear interfaces
  layers: {
    // 🎯 API Layer
    routes/          // Express/Hono routes
    middleware/      // Auth, validation, rate limiting

    // 🎯 Orchestration Layer
    services/
      UnifiedSearchService     // Current, enhanced
      MultiEngineCoordinator   // New, optional

    // 🎯 Engine Layer
    engines/         // Current search engines
    adapters/        // Engine-specific adapters

    // 🎯 Storage Layer
    storage/
      KVStorageService        // KV operations
      CacheManager           // Cache strategies

    // 🎯 Processing Layer
    processors/
      ResultProcessor        // Keyword extraction
      DeduplicationService   // Duplicate handling

    // 🎯 Infrastructure Layer
    config/          // Configuration management
    utils/           // Shared utilities
    types/           // Type definitions
  }
}
```

### Phase 2: Extract Heavy Processing (If Needed)

```typescript
// If processing becomes too heavy, extract to separate worker
ResultProcessingWorker {
  // Background keyword extraction
  // Heavy deduplication logic
  // Triggered via CloudFlare Queues
}

// Main API becomes lighter
SearchAPI {
  // Fast search responses
  // Basic result merging
  // Queue heavy processing
}
```

### Phase 3: Scale Specific Components (If Needed)

```typescript
// Extract only if specific bottlenecks emerge
SpecializedWorkers {
  EngineWorker,      // If engine calls become bottleneck
  CacheWorker,       // If KV operations need optimization
  AggregationWorker  // If result merging is too slow
}
```

## Simplified Implementation Plan

### Immediate Focus (Phase 1):

1. **Fix Brave pagination** (current issue)
2. **Implement KV storage layer** (replace in-memory caching)
3. **Add basic multi-engine support** (sequential calls)
4. **Optimize KV usage** (chunking, compression)

### Future Enhancements (Phase 2+):

1. **Add result processing** (keywords, deduplication)
2. **Implement parallel engine calls**
3. **Add advanced caching strategies**
4. **Extract heavy processing if needed**

## Key Architectural Principles:

1. **Start Simple**: Layered monolith with clear boundaries
2. **Measure First**: Identify actual bottlenecks before splitting
3. **Extract Gradually**: Move to microservices only when justified
4. **Maintain Interfaces**: Design for future extraction
5. **Optimize for KV**: Minimize operations, maximize cache hits

## Decision Point:

**Should we proceed with the enhanced layered monolith approach, or start with a more distributed architecture from the beginning?**

The layered monolith gives us:

- ✅ Faster development
- ✅ Easier debugging
- ✅ Better KV efficiency
- ✅ Simpler deployment
- ✅ Clear upgrade path to microservices

While maintaining the flexibility to extract components later when we have real performance data and usage patterns.
