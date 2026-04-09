import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from './context';
import { createAppRouter } from './router';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { auth, runMigrations } from './auth';
import { createDbAdapter, initProjectsTable, initUserSettingsTable } from './db';
import { resolve, join } from 'path';

dotenv.config();

await runMigrations();

const db = createDbAdapter();
await initProjectsTable(db);
await initUserSettingsTable(db);

const defaultApiKey = process.env['GEMINI_API_KEY'] as string;
const appRouter = createAppRouter(
  (key?: string) => new GoogleGenAI({ apiKey: key ?? defaultApiKey }),
  db
);

export type { AppRouter } from './router';

const publicDir = resolve(import.meta.dir, 'public');

Bun.serve({
  port: Number(process.env['PORT'] || 3000),
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);

    // Auth routes → Better Auth
    if (url.pathname.startsWith('/api/auth')) {
      return auth.handler(req);
    }

    // tRPC routes
    if (url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/auth')) {
      return fetchRequestHandler({
        endpoint: '/api',
        req,
        router: appRouter,
        createContext: () => createTRPCContext({ headers: new Headers(req.headers) }),
      });
    }

    // Static files
    const safePath = join(publicDir, decodeURIComponent(url.pathname));
    if (!safePath.startsWith(publicDir)) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(safePath);
    if (await file.exists() && !safePath.endsWith('/')) {
      return new Response(file);
    }

    // SPA fallback — serve index.html for all other routes
    const indexFile = Bun.file(join(publicDir, 'index.html'));
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not found — run the client build first', { status: 404 });
  },
});

console.log(`Server running on http://localhost:${process.env['PORT'] || 3000}`);
