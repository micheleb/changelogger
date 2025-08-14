import { Database } from 'bun:sqlite';
import { join } from 'path';
import { statSync } from 'fs';
import type { VersionChangesWithVersion } from './types.ts';

export interface CacheEntry {
  key: string;
  repo: string;
  fileMtime: number;
  data: string;
  createdAt: number;
}

export class CacheManager {
  private enabled: boolean;
  private db?: Database;
  private ttlMs: number;
  private dbPath: string;

  constructor() {
    this.enabled = process.env.SQLITE_CACHE === 'true';
    this.ttlMs = parseInt(process.env.SQLITE_CACHE_TTL_HOURS || '168') * 60 * 60 * 1000; // 7 days default
    this.dbPath = process.env.SQLITE_CACHE_DB_PATH || './cache.db';
    
    if (this.enabled) {
      this.initializeDatabase();
    }
  }

  private initializeDatabase(): void {
    try {
      this.db = new Database(this.dbPath);
      
      // Create tables and indexes
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cache_entries (
          key TEXT PRIMARY KEY,
          repo TEXT NOT NULL,
          file_mtime INTEGER NOT NULL,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_repo_mtime ON cache_entries(repo, file_mtime);
        CREATE INDEX IF NOT EXISTS idx_created_at ON cache_entries(created_at);
      `);

      // Clean up expired entries on startup
      this.cleanup();
      
    } catch (error) {
      console.warn(`Failed to initialize SQLite cache: ${(error as Error).message}`);
      this.enabled = false;
    }
  }

  private generateCacheKey(repo: string, fileMtime: number, operation: string, params: string): string {
    return `${repo}_${fileMtime}_${operation}_${params}`;
  }

  private getFileMtime(repoPath: string): number | null {
    try {
      const changelogPath = join(repoPath, 'CHANGELOG.md');
      const stats = statSync(changelogPath);
      return stats.mtimeMs;
    } catch {
      return null;
    }
  }

  async get(repo: string, repoPath: string, operation: string, params: string): Promise<VersionChangesWithVersion | null> {
    if (!this.enabled || !this.db) {
      return null;
    }

    try {
      const fileMtime = this.getFileMtime(repoPath);
      if (fileMtime === null) {
        return null;
      }

      const key = this.generateCacheKey(repo, fileMtime, operation, params);
      
      const stmt = this.db.prepare('SELECT * FROM cache_entries WHERE key = ?');
      const entry = stmt.get(key) as CacheEntry | undefined;
      
      if (!entry) {
        return null;
      }

      // Check if entry is expired
      if (Date.now() - entry.createdAt > this.ttlMs) {
        this.delete(key);
        return null;
      }

      return JSON.parse(entry.data) as VersionChangesWithVersion;
    } catch (error) {
      console.warn(`Cache get error: ${(error as Error).message}`);
      return null;
    }
  }

  async set(repo: string, repoPath: string, operation: string, params: string, data: VersionChangesWithVersion): Promise<void> {
    if (!this.enabled || !this.db) {
      return;
    }

    try {
      const fileMtime = this.getFileMtime(repoPath);
      if (fileMtime === null) {
        return;
      }

      const key = this.generateCacheKey(repo, fileMtime, operation, params);
      const serializedData = JSON.stringify(data);
      const createdAt = Date.now();

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cache_entries (key, repo, file_mtime, data, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(key, repo, fileMtime, serializedData, createdAt);
    } catch (error) {
      console.warn(`Cache set error: ${(error as Error).message}`);
    }
  }

  private delete(key: string): void {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare('DELETE FROM cache_entries WHERE key = ?');
      stmt.run(key);
    } catch (error) {
      console.warn(`Cache delete error: ${(error as Error).message}`);
    }
  }

  async invalidateRepo(repo: string): Promise<void> {
    if (!this.enabled || !this.db) {
      return;
    }

    try {
      const stmt = this.db.prepare('DELETE FROM cache_entries WHERE repo = ?');
      stmt.run(repo);
    } catch (error) {
      console.warn(`Cache invalidation error: ${(error as Error).message}`);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.enabled || !this.db) {
      return;
    }

    try {
      const cutoff = Date.now() - this.ttlMs;
      const stmt = this.db.prepare('DELETE FROM cache_entries WHERE created_at < ?');
      const result = stmt.run(cutoff);
      
      if (result.changes > 0) {
        console.log(`Cache cleanup: removed ${result.changes} expired entries`);
      }
    } catch (error) {
      console.warn(`Cache cleanup error: ${(error as Error).message}`);
    }
  }

  async getStats(): Promise<{ enabled: boolean; entries: number; size: string }> {
    if (!this.enabled || !this.db) {
      return { enabled: false, entries: 0, size: '0 B' };
    }

    try {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM cache_entries');
      const countResult = countStmt.get() as { count: number };
      
      const sizeStmt = this.db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
      const sizeResult = sizeStmt.get() as { size: number };
      
      const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        enabled: true,
        entries: countResult.count,
        size: formatSize(sizeResult.size)
      };
    } catch (error) {
      console.warn(`Cache stats error: ${(error as Error).message}`);
      return { enabled: true, entries: 0, size: 'unknown' };
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager();