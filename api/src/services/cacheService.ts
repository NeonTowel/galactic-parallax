import { SearchRequest, ApiResponse } from '../types';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  staleWhileRevalidate?: number; // Additional time to serve stale content while revalidating
}

export interface CacheKey {
  prefix: string;
  params: Record<string, any>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SEARCH_CACHE_TTL = 604800; // 1 week for search results
  private static readonly SUGGESTIONS_CACHE_TTL = 86400; // 24 hours for suggestions
  private static readonly HEALTH_CACHE_TTL = 300; // 5 minutes for health checks

  // Simple in-memory cache for Cloudflare Workers
  private static cache = new Map<string, CacheEntry<any>>();

  /**
   * Generates a consistent cache key from request parameters
   */
  private static generateCacheKey(cacheKey: CacheKey): string {
    const sortedParams = Object.keys(cacheKey.params)
      .sort()
      .reduce((result, key) => {
        result[key] = cacheKey.params[key];
        return result;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sortedParams);
    const hash = this.simpleHash(paramsString);
    
    return `${cacheKey.prefix}:${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Creates a cache-aware search key for search requests
   */
  static createSearchCacheKey(
    request: SearchRequest & { engine?: string }, 
    userId?: string
  ): string {
    return this.generateCacheKey({
      prefix: 'search',
      params: {
        query: request.query.toLowerCase().trim(),
        orientation: request.orientation || 'any',
        count: request.count || 10,
        start: request.start || 1,
        engine: request.engine || 'default',
        // Include user ID for personalized caching if needed
        ...(userId && { userId })
      }
    });
  }

  /**
   * Creates a cache key for suggestions
   */
  static createSuggestionsCacheKey(category: string): string {
    return this.generateCacheKey({
      prefix: 'suggestions',
      params: { category }
    });
  }

  /**
   * Creates a cache key for health checks
   */
  static createHealthCacheKey(): string {
    return this.generateCacheKey({
      prefix: 'health',
      params: { check: 'search-service' }
    });
  }

  /**
   * Retrieves cached data
   */
  static async getFromCache<T>(cacheKey: string): Promise<T | null> {
    try {
      const entry = this.cache.get(cacheKey);
      
      if (!entry) {
        return null;
      }

      // Check if cache entry is still valid
      const now = Date.now();
      const age = now - entry.timestamp;
      
      if (age > entry.ttl * 1000) {
        // Cache expired, remove it
        this.cache.delete(cacheKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Stores data in cache
   */
  static async setCache<T>(
    cacheKey: string,
    data: T,
    config: CacheConfig = { ttl: this.DEFAULT_TTL }
  ): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: config.ttl
      };

      this.cache.set(cacheKey, entry);

      // Clean up expired entries periodically (simple cleanup)
      if (this.cache.size > 100) {
        this.cleanupExpiredEntries();
      }
    } catch (error) {
      console.error('Cache storage error:', error);
      // Don't throw - caching failures shouldn't break the API
    }
  }

  /**
   * Clean up expired cache entries
   */
  private static cleanupExpiredEntries(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl * 1000) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidates cache entries by pattern
   */
  static async invalidateCache(pattern: string): Promise<void> {
    try {
      const regex = new RegExp(pattern);
      
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Gets cache configuration for different types of requests
   */
  static getCacheConfig(type: 'search' | 'suggestions' | 'health'): CacheConfig {
    switch (type) {
      case 'search':
        return { 
          ttl: this.SEARCH_CACHE_TTL,
          staleWhileRevalidate: 300 // 5 minutes stale-while-revalidate
        };
      case 'suggestions':
        return { 
          ttl: this.SUGGESTIONS_CACHE_TTL,
          staleWhileRevalidate: 3600 // 1 hour stale-while-revalidate
        };
      case 'health':
        return { 
          ttl: this.HEALTH_CACHE_TTL,
          staleWhileRevalidate: 60 // 1 minute stale-while-revalidate
        };
      default:
        return { ttl: this.DEFAULT_TTL };
    }
  }

  /**
   * Wrapper function for cache-aware operations
   */
  static async withCache<T>(
    cacheKey: string,
    operation: () => Promise<T>,
    cacheType: 'search' | 'suggestions' | 'health' = 'search'
  ): Promise<{ data: T; fromCache: boolean }> {
    // Try to get from cache first
    const cachedData = await this.getFromCache<T>(cacheKey);
    
    if (cachedData) {
      return { data: cachedData, fromCache: true };
    }

    // Execute operation if not in cache
    const freshData = await operation();
    
    // Store in cache for future requests
    const cacheConfig = this.getCacheConfig(cacheType);
    await this.setCache(cacheKey, freshData, cacheConfig);
    
    return { data: freshData, fromCache: false };
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clear all cache entries
   */
  static clearCache(): void {
    this.cache.clear();
  }
} 