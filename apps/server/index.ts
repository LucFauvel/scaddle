import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createTRPCContext } from './context';
import { createAppRouter } from './router';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { auth, runMigrations } from './auth';
import { createDbAdapter, initProjectsTable, initUserSettingsTable } from './db';
import { toNodeHandler } from 'better-auth/node';

dotenv.config();

await runMigrations();

const db = createDbAdapter();
await initProjectsTable(db);
await initUserSettingsTable(db);

const authHandler = toNodeHandler(auth);

const defaultApiKey = process.env['GEMINI_API_KEY'] as string;
const appRouter = createAppRouter(
  (key?: string) => new GoogleGenAI({ apiKey: key ?? defaultApiKey }),
  db
);

export type { AppRouter } from './router';

const allowedOrigins = process.env['CORS_ORIGINS']
  ? process.env['CORS_ORIGINS'].split(',').map(o => o.trim())
  : true;

const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true,
});

const server = createHTTPServer({
  middleware: (req, res, next) => {
    corsMiddleware(req, res, () => {
      // Route auth requests to Better Auth handler
      if (req.url?.startsWith('/api/auth')) {
        return authHandler(req, res);
      }
      return next();
    });
  },
  router: appRouter,
  createContext: ({ req }) => createTRPCContext({ headers: new Headers(req.headers as Record<string, string>) }),
});

server.listen(3000, '0.0.0.0');
console.log('Server running on http://localhost:3000');
