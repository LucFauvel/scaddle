import { Pool } from "pg";
import { Database } from "bun:sqlite";
import type { DbAdapter } from './db-adapter';

const isProduction = process.env['NODE_ENV'] === 'production';

// Raw database instance kept for Better Auth (which manages its own queries)
export const database = isProduction
  ? new Pool({ connectionString: process.env['DATABASE_URL'] })
  : new Database(process.env['SQLITE_PATH'] || 'dev.sqlite');

export function createDbAdapter(): DbAdapter {
  if (isProduction) {
    const pool = database as Pool;
    return {
      async query<T>(sql: string, params: unknown[] = []) {
        let i = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++i}`);
        const result = await pool.query(pgSql, params as unknown[]);
        return result.rows as T[];
      },
      async run(sql: string, params: unknown[] = []) {
        let i = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++i}`);
        await pool.query(pgSql, params as unknown[]);
      },
    };
  } else {
    const sqlite = database as Database;
    return {
      async query<T>(sql: string, params: unknown[] = []) {
        return sqlite.prepare(sql).all(...(params as any[])) as T[];
      },
      async run(sql: string, params: unknown[] = []) {
        sqlite.prepare(sql).run(...(params as any[]));
      },
    };
  }
}

export async function initUserSettingsTable(db: DbAdapter): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      gemini_api_key TEXT NOT NULL
    )
  `);
}

export async function initProjectsTable(db: DbAdapter): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT '',
      chat TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add chat column to tables created before this migration — ignore if already exists.
  try {
    await db.run(`ALTER TABLE projects ADD COLUMN chat TEXT NOT NULL DEFAULT '[]'`);
  } catch { /* column already present */ }
}
