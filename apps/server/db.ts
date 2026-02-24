import { Pool } from "pg";
import { Database } from "bun:sqlite";

const isProduction = process.env['NODE_ENV'] === 'production';

function createDatabaseAdapter() {
  if (isProduction) {
    return new Pool({
      connectionString: process.env['DATABASE_URL'],
    });
  }
  return new Database(process.env['SQLITE_PATH'] || 'dev.sqlite');
}

export const database = createDatabaseAdapter();
