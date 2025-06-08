import { SearchRequest, IntermediarySearchResult, IntermediarySearchResponse, ApiResponse } from '../types';
import { GoogleSearchEngine } from './googleSearchEngine';
import { BraveSearchEngine } from './braveSearchEngine';
import { SerperSearchEngine } from './serperSearchEngine';
import { debugLog } from './queryUtils';

const GOOGLE_PAGE_COUNT = 5; // Configurable number of Google pages to fetch

async function sha1(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safe(v: any) { return v === undefined ? null : v; }

function logAndCheck(sql: string, params: any[], expected: number) {
  if (params.length !== expected) {
    console.error('PARAM COUNT MISMATCH', { sql, params, expected, actual: params.length });
  }
  console.log('SQL:', sql, 'PARAMS:', params);
}

export class AggregatedSearchService {
  db: any;
  env: any;

  constructor(db: any, env?: any) {
    this.db = db;
    this.env = env;
  }

  async search(request: SearchRequest, userId?: string): Promise<ApiResponse<IntermediarySearchResponse>> {
    try {
      const aggId = await this.generateAggId(request);
      let meta = await this.getAggregatedResult(aggId);
      if (!meta) {
        const rawResults = await this.fetchFromEngines(request);
        const deduped = this.deduplicateResults(rawResults);
        const optimized = this.optimizeResults(deduped, request.query);
        const keywords = this.extractKeywords(request.query);
        const enginesUsed = this.getEnginesUsed();
        await this.storeAggregatedResult(
          {
            id: aggId,
            query: request.query,
            keywords: keywords.join(','),
            orientation: request.orientation,
            tbs: request.tbs,
            engines_used: JSON.stringify(enginesUsed),
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
            user_id: userId || null
          },
          optimized
        );
        meta = await this.getAggregatedResult(aggId);
      }
      const count = request.count && request.count > 0 ? request.count : 10;
      const start = request.start && request.start > 0 ? request.start : 1;
      const offset = start - 1;
      const results = await this.getPaginatedResults(aggId, offset, count);
      const totalResults = await this.getTotalResults(aggId);
      const totalPages = count > 0 ? Math.ceil(totalResults / count) : 1;
      const currentPage = count > 0 ? Math.ceil(start / count) : 1;
      const pagination = {
        currentPage,
        totalResults,
        resultsPerPage: count,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        nextStartIndex: currentPage < totalPages ? start + count : undefined,
        previousStartIndex: currentPage > 1 ? Math.max(1, start - count) : undefined
      };
      const searchInfo = {
        query: request.query,
        orientation: request.orientation,
        searchTime: 0,
        searchEngine: 'aggregated',
        timestamp: new Date().toISOString()
      };
      return {
        success: true,
        data: {
          results,
          pagination,
          searchInfo
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async storeAggregatedResult(result: any, items: IntermediarySearchResult[]) {
    const aggParams = [
      safe(result.id), safe(result.query), safe(result.keywords), safe(result.orientation), safe(result.tbs), safe(result.engines_used), safe(result.created_at), safe(result.expires_at), safe(result.user_id)
    ];
    logAndCheck(
      `INSERT OR REPLACE INTO aggregated_results (id, query, keywords, orientation, tbs, engines_used, created_at, expires_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      aggParams, 9
    );
    const aggStmt = this.db.prepare(
      `INSERT OR REPLACE INTO aggregated_results (id, query, keywords, orientation, tbs, engines_used, created_at, expires_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(...aggParams);

    const itemStmts = items.map(item => {
      const itemParams = [
        safe(item.id), safe(result.id), safe(item.title), safe(item.url), safe(item.thumbnailUrl), safe(item.sourceUrl), safe(item.sourceDomain), safe(item.description), safe(item.width), safe(item.height), safe(item.fileSize), safe(item.mimeType), safe(item.fileFormat), safe(item.sourceEngine)
      ];
      logAndCheck(
        `INSERT OR REPLACE INTO result_items (id, agg_id, title, url, thumbnailUrl, sourceUrl, sourceDomain, description, width, height, fileSize, mimeType, fileFormat, source_engine)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        itemParams, 14
      );
      return this.db.prepare(
        `INSERT OR REPLACE INTO result_items (id, agg_id, title, url, thumbnailUrl, sourceUrl, sourceDomain, description, width, height, fileSize, mimeType, fileFormat, source_engine)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(...itemParams);
    });
    await this.db.batch([
      aggStmt,
      ...itemStmts
    ]);
  }

  async getPaginatedResults(aggId: string, offset: number, limit: number): Promise<IntermediarySearchResult[]> {
    logAndCheck(
      `SELECT * FROM result_items WHERE agg_id = ? ORDER BY rowid ASC LIMIT ? OFFSET ?`,
      [aggId, limit, offset], 3
    );
    const { results } = await this.db.prepare(
      `SELECT * FROM result_items WHERE agg_id = ? ORDER BY rowid ASC LIMIT ? OFFSET ?`
    ).bind(aggId, limit, offset).all();
    return results as IntermediarySearchResult[];
  }

  async getAggregatedResult(aggId: string): Promise<any> {
    logAndCheck(
      `SELECT * FROM aggregated_results WHERE id = ?`,
      [aggId], 1
    );
    const { results } = await this.db.prepare(
      `SELECT * FROM aggregated_results WHERE id = ?`
    ).bind(aggId).all();
    return results[0] || null;
  }

  async getTotalResults(aggId: string): Promise<number> {
    logAndCheck(
      `SELECT COUNT(*) as count FROM result_items WHERE agg_id = ?`,
      [aggId], 1
    );
    const { results } = await this.db.prepare(
      `SELECT COUNT(*) as count FROM result_items WHERE agg_id = ?`
    ).bind(aggId).all();
    return results[0]?.count || 0;
  }

  async getSearchSuggestions(prefix: string, userId: string, limit = 10): Promise<string[]> {
    if (!prefix || !userId) {
      return [];
    }

    const likePattern = `${prefix}%`;
    const d1Response = await this.db.prepare(
      `SELECT DISTINCT query FROM aggregated_results WHERE user_id = ? AND query LIKE ? ORDER BY query ASC LIMIT ?`
    ).bind(userId, likePattern, limit).all();

    if (d1Response.error) {
      console.error(`D1 error fetching suggestions: ${d1Response.error}`);
      return [];
    }

    const suggestions = d1Response.results?.map((row: { query: string }) => row.query) || [];
    return suggestions;
  }

  async clearUserCache(userId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    if (!userId) {
      return { success: false, error: 'User ID is required to clear cache.', message: 'User ID is required.' };
    }
    try {
      debugLog('LOG_REQUESTS', '🗑️ [CACHE CLEAR REQUEST]', { user: userId });
      const stmt = this.db.prepare(
        `DELETE FROM aggregated_results WHERE user_id = ?`
      ).bind(userId);
      const info = await stmt.run();

      if (info.error) {
        console.error(`D1 error clearing cache for user ${userId}: ${info.error}`);
        debugLog('LOG_REQUESTS', '❌ [CACHE CLEAR FAILED]', { user: userId, error: info.error });
        return { success: false, error: `Failed to clear cache: ${info.error}` };
      }
      
      const count = info.changes !== undefined ? info.changes : 0; // .changes should reflect deleted rows
      debugLog('LOG_REQUESTS', '✅ [CACHE CLEARED]', { user: userId, clearedAggregations: count });
      return { success: true, message: `Cache cleared. ${count} search(es) removed.` };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error clearing cache';
      console.error(`Exception clearing cache for user ${userId}: ${errorMessage}`);
      debugLog('LOG_REQUESTS', '💥 [CACHE CLEAR EXCEPTION]', { user: userId, error: errorMessage });
      return { success: false, error: `An unexpected error occurred: ${errorMessage}` };
    }
  }

  deduplicateResults(results: IntermediarySearchResult[]): IntermediarySearchResult[] {
    const seen = new Set<string>();
    const deduped: IntermediarySearchResult[] = [];
    for (const item of results) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        deduped.push(item);
      }
    }
    return deduped;
  }

  optimizeResults(results: IntermediarySearchResult[], query: string): IntermediarySearchResult[] {
    // Sort by resolution (width * height, descending). If missing/zero, de-prioritize.
    return results.slice().sort((a, b) => {
      const aRes = (a.width && a.height) ? a.width * a.height : 0;
      const bRes = (b.width && b.height) ? b.width * b.height : 0;
      if (aRes === bRes) return 0;
      if (aRes === 0) return 1;
      if (bRes === 0) return -1;
      return bRes - aRes;
    });
  }

  extractKeywords(query: string): string[] {
    // Lowercase, split on whitespace, filter unique, remove empty
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return Array.from(new Set(words));
  }

  async generateAggId(request: SearchRequest): Promise<string> {
    const base = `${request.query}|${request.orientation || ''}|${request.tbs || ''}`;
    return await sha1(base);
  }

  getEnginesUsed(): string[] {
    const engines: string[] = ['google'];
    if (this.env?.BRAVE_SEARCH_API_KEY) engines.push('brave');
    if (this.env?.SERPER_API_KEY) engines.push('serper');
    return engines;
  }

  async fetchFromEngines(request: SearchRequest): Promise<IntermediarySearchResult[]> {
    const results: IntermediarySearchResult[] = [];
    const errors: string[] = [];

    // Instantiate engines from env
    const google = new GoogleSearchEngine(this.env.GOOGLE_SEARCH_API_KEY, this.env.GOOGLE_SEARCH_ENGINE_ID);
    const brave = this.env.BRAVE_SEARCH_API_KEY ? new BraveSearchEngine(this.env.BRAVE_SEARCH_API_KEY) : null;
    const serper = this.env.SERPER_API_KEY ? new SerperSearchEngine(this.env.SERPER_API_KEY) : null;

    // Google: fetch up to N pages
    try {
      const googlePageResults: IntermediarySearchResult[] = [];
      const count = request.count && request.count > 0 ? request.count : 10;
      for (let i = 0; i < GOOGLE_PAGE_COUNT; i++) {
        const start = 1 + i * count;
        const pageReq = { ...request, count, start };
        const resp = await google.search(pageReq);
        if (resp.success && resp.data?.results) {
          googlePageResults.push(...resp.data.results);
        }
      }
      results.push(...googlePageResults);
    } catch (err) {
      errors.push('Google: ' + (err instanceof Error ? err.message : String(err)));
    }

    // Brave: fetch up to 100 results
    if (brave) {
      try {
        const braveReq = { ...request, count: 100, start: 1 };
        const resp = await brave.search(braveReq);
        if (resp.success && resp.data?.results) {
          results.push(...resp.data.results);
        }
      } catch (err) {
        errors.push('Brave: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    // Serper: fetch up to 100 results
    if (serper) {
      try {
        const serperReq = { ...request, count: 100, start: 1 };
        const resp = await serper.search(serperReq);
        if (resp.success && resp.data?.results) {
          results.push(...resp.data.results);
        }
      } catch (err) {
        errors.push('Serper: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    // Optionally log errors (could use debugLog if available)
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Engine fetch errors:', errors);
    }

    return results;
  }
} 