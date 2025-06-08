// Durable Object for caching aggregated search results using D1 (SQLite)
// Types DurableObjectState, Env, and D1Database are provided by the Cloudflare Workers runtime
import { IntermediarySearchResult } from '../types';

export interface AggregatedResult {
  id: string;
  query: string;
  keywords: string;
  orientation?: string;
  tbs?: string;
  engines_used: string;
  created_at: string;
  expires_at: string;
  user_id?: string;
}

/**
 * @typedef {object} D1Database
 * @description Provided by Cloudflare Workers runtime. See: https://developers.cloudflare.com/d1/platform/client-api/
 */

export class AggregatedResultsDurableObject {
  // These are provided by the Cloudflare Workers runtime
  state: any;
  env: any;
  sql: any;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.initialize();
  }

  async initialize() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS aggregated_results (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        keywords TEXT,
        orientation TEXT,
        tbs TEXT,
        engines_used TEXT,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        user_id TEXT
      );
      CREATE TABLE IF NOT EXISTS result_items (
        id TEXT PRIMARY KEY,
        agg_id TEXT NOT NULL,
        title TEXT,
        url TEXT,
        thumbnailUrl TEXT,
        sourceUrl TEXT,
        sourceDomain TEXT,
        description TEXT,
        width INTEGER,
        height INTEGER,
        fileSize INTEGER,
        mimeType TEXT,
        fileFormat TEXT,
        FOREIGN KEY (agg_id) REFERENCES aggregated_results(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_agg_id ON result_items(agg_id);
      CREATE INDEX IF NOT EXISTS idx_expires_at ON aggregated_results(expires_at);
    `);
  }

  async storeAggregatedResult(
    result: AggregatedResult,
    items: IntermediarySearchResult[]
  ) {
    const now = new Date().toISOString();
    this.sql.exec(
      `INSERT OR REPLACE INTO aggregated_results (id, query, keywords, orientation, tbs, engines_used, created_at, expires_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      result.id,
      result.query,
      result.keywords,
      result.orientation,
      result.tbs,
      result.engines_used,
      result.created_at || now,
      result.expires_at,
      result.user_id || null
    );
    for (const item of items) {
      this.sql.exec(
        `INSERT OR REPLACE INTO result_items (id, agg_id, title, url, thumbnailUrl, sourceUrl, sourceDomain, description, width, height, fileSize, mimeType, fileFormat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        item.id,
        result.id,
        item.title,
        item.url,
        item.thumbnailUrl,
        item.sourceUrl,
        item.sourceDomain,
        item.description,
        item.width,
        item.height,
        item.fileSize,
        item.mimeType,
        item.fileFormat
      );
    }
  }

  async getPaginatedResults(aggId: string, offset: number, limit: number) {
    const rows = this.sql.exec(
      `SELECT * FROM result_items WHERE agg_id = ? ORDER BY rowid ASC LIMIT ? OFFSET ?;`,
      aggId, limit, offset
    ).toArray();
    return rows as IntermediarySearchResult[];
  }

  async getAggregatedResult(aggId: string): Promise<AggregatedResult | null> {
    const rows = this.sql.exec(
      `SELECT * FROM aggregated_results WHERE id = ?;`,
      aggId
    ).toArray();
    return rows[0] as AggregatedResult || null;
  }

  async cleanupExpired() {
    const now = new Date().toISOString();
    this.sql.exec(
      `DELETE FROM aggregated_results WHERE expires_at < ?;`,
      now
    );
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const aggId = this.state.id.toString();

    if (request.method === 'POST' && pathname === '/store') {
      // Store aggregated result and items
      const body = await request.json();
      await this.storeAggregatedResult(body.result, body.items);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'GET' && pathname === '/results') {
      // Paginated results
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      const results = await this.getPaginatedResults(aggId, offset, limit);
      return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'GET' && pathname === '/meta') {
      // Aggregated result meta
      const meta = await this.getAggregatedResult(aggId);
      if (!meta) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(meta), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  }
} 