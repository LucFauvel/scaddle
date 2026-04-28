import { publicProcedure, protectedProcedure, createTRPCRouter } from './trpc';
import { TRPCError } from '@trpc/server';
import type { DbAdapter } from './db-adapter';
import z from 'zod';
import { randomUUID } from 'crypto';

interface GenAI {
  models: {
    generateContent(opts: {
      model: string;
      contents: string;
      config: { systemInstruction: string[] };
    }): Promise<{ text?: string }>;
  };
}

interface ProjectRow {
  id: string;
  title: string;
  code: string;
  chat: string;
  created_at: string;
  updated_at: string;
}

// getGenAI is a factory so each request can use the caller's own API key
// without importing the Google SDK into this file.
export const createAppRouter = (getGenAI: (apiKey?: string) => GenAI, db: DbAdapter) =>
  createTRPCRouter({
    askChat: publicProcedure
      .input(z.object({ message: z.string().trim().min(1), currentCode: z.string() }))
      .query(async function ({ input, ctx }) {
        // Look up user's own API key, fall back to server default (undefined → factory uses default)
        let userKey: string | undefined;
        if (ctx.user?.id) {
          const [row] = await db.query<{ gemini_api_key: string }>(
            `SELECT gemini_api_key FROM user_settings WHERE user_id = ?`,
            [ctx.user.id]
          );
          userKey = row?.gemini_api_key || undefined;
        }

        const genAI = getGenAI(userKey);
        const contents = input.currentCode.trim()
          ? `Current OpenSCAD code:\n\`\`\`openscad\n${input.currentCode}\n\`\`\`\n\nUser request: ${input.message}`
          : `User request: ${input.message}`;

        let result: { text?: string };
        try {
          result = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents,
            config: {
              systemInstruction: [
                `You are an engineer and CAD expert specialising in OpenSCAD.`,
                `You respond ONLY with raw OpenSCAD code — no markdown fences, no explanation, no commentary.`,
                `If the user provides existing code, you MUST base your response on that code, modifying only what the request asks for and preserving everything else.`,
                `If no existing code is provided, generate new code from scratch that fulfills the request.`,
                `Always expose key dimensions and parameters as top-level variables so they are easy to adjust.`,
                `If you cannot fulfill the request, respond with an empty string.`,
              ]
            }
          });
        } catch (e: unknown) {
          const raw = String((e as any)?.message ?? '');
          // The Gemini SDK wraps the API response as a JSON string in `message`.
          // Pull out the human-readable bit so the chat doesn't show raw JSON.
          let msg = raw;
          try {
            const parsed = JSON.parse(raw);
            msg = parsed?.error?.message ?? raw;
          } catch {}
          if (raw.includes('429') || /quota|rate.?limit|resource.?exhaust/i.test(raw)) {
            throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Usage limit reached — try again in a moment.' });
          }
          if (/503|UNAVAILABLE|high demand/i.test(raw)) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The model is currently busy — please try again in a moment.' });
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg ? `AI generation failed: ${msg}` : 'AI generation failed — please try again.' });
        }
        return result.text?.replace(/```openscad\s*/gi, '')?.replace(/```\s*/g, '')?.trim() || '';
      }),

    settings: createTRPCRouter({
      hasApiKey: protectedProcedure
        .query(async ({ ctx }) => {
          const [row] = await db.query<{ gemini_api_key: string }>(
            `SELECT gemini_api_key FROM user_settings WHERE user_id = ?`,
            [ctx.user.id]
          );
          return !!row?.gemini_api_key;
        }),

      setApiKey: protectedProcedure
        .input(z.object({ apiKey: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          await db.run(
            `INSERT INTO user_settings (user_id, gemini_api_key) VALUES (?, ?)
             ON CONFLICT(user_id) DO UPDATE SET gemini_api_key = excluded.gemini_api_key`,
            [ctx.user.id, input.apiKey]
          );
        }),

      clearApiKey: protectedProcedure
        .mutation(async ({ ctx }) => {
          await db.run(
            `DELETE FROM user_settings WHERE user_id = ?`,
            [ctx.user.id]
          );
        }),
    }),

    projects: createTRPCRouter({
      list: protectedProcedure
        .query(async ({ ctx }) => {
          return await db.query<ProjectRow>(
            `SELECT id, title, code, chat, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC`,
            [ctx.user.id]
          );
        }),

      create: protectedProcedure
        .input(z.object({
          title: z.string().min(1).max(100),
          initialCode: z.string().default(''),
        }))
        .mutation(async ({ ctx, input }) => {
          const id = randomUUID();
          await db.run(
            `INSERT INTO projects (id, user_id, title, code) VALUES (?, ?, ?, ?)`,
            [id, ctx.user.id, input.title, input.initialCode]
          );
          const [project] = await db.query<ProjectRow>(
            `SELECT id, title, code, chat, created_at, updated_at FROM projects WHERE id = ?`,
            [id]
          );
          return project;
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.string(),
          title: z.string().min(1).max(100).optional(),
          code: z.string().optional(),
          chat: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const sets: string[] = [];
          const params: unknown[] = [];
          if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
          if (input.code !== undefined)  { sets.push('code = ?');  params.push(input.code); }
          if (input.chat !== undefined)  { sets.push('chat = ?');  params.push(input.chat); }
          if (!sets.length) return;
          sets.push('updated_at = CURRENT_TIMESTAMP');
          params.push(input.id, ctx.user.id);
          await db.run(
            `UPDATE projects SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
            params
          );
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
          await db.run(
            `DELETE FROM projects WHERE id = ? AND user_id = ?`,
            [input.id, ctx.user.id]
          );
        }),
    }),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
