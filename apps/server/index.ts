import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { publicProcedure, router } from './trpc';
import z from 'zod';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
 
const genAI = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY'] as string });
 
const appRouter = router({
  askChat: publicProcedure
    .input(z.string())
    .query(async function ({ input }) {
      const result = await genAI.models.generateContent(
      { 
        model: "gemini-2.5-flash",
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

const server = createHTTPServer({
  middleware: cors(),
  router: appRouter,
});
 
server.listen(3000);

