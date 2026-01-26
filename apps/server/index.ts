import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { publicProcedure, createTRPCRouter as router, createTRPCContext } from './trpc';
import z from 'zod';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { auth } from './auth';
import { toNodeHandler } from 'better-auth/node';

dotenv.config();

const authHandler = toNodeHandler(auth);
 
const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY'] as string });

const appRouter = router({
  askChat: publicProcedure
    .input(z.string())
    .query(async function ({ input }) {
      const result = await genAI.models.generateContent(
      { 
        model: "gemini-3-flash-preview",
        contents: input,
        config: {
          systemInstruction: [
            `You are an engineer and CAD expert.`,
            `You are specifically trained to write OpenSCAD code.`,
            `When you receive a prompt, you will respond with OpenSCAD code that fulfills the request.`,
            `You will only respond with OpenSCAD code, and nothing else.`,
            `If you do not know how to write the code, you will respond with an empty string.`
          ] 
        }
      });
      return result.text?.replace('```openscad', '')?.replace('```', '') || '';
    })
});

export type AppRouter = typeof appRouter;

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

