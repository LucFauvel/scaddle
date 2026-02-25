import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { createTRPCContext } from './context';
import { createAppRouter } from './router';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { auth, runMigrations } from './auth';
import { toNodeHandler } from 'better-auth/node';

dotenv.config();

await runMigrations();

const authHandler = toNodeHandler(auth);

const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY'] as string });

const appRouter = createAppRouter(genAI);

export type { AppRouter } from './router';

const corsMiddleware = cors({
  origin: ['http://localhost:4200', 'http://localhost:3000'],
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

server.listen(3000);
console.log('Server running on http://localhost:3000');
