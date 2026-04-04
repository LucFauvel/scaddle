import { publicProcedure, protectedProcedure, createTRPCRouter } from './trpc';
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
  created_at: string;
  updated_at: string;
}

export const createAppRouter = (genAI: GenAI, db: DbAdapter) =>
  createTRPCRouter({
    askChat: publicProcedure
      .input(z.object({ message: z.string(), currentCode: z.string() }))
      .query(async function ({ input }) {
        const contents = input.currentCode.trim()
          ? `Current OpenSCAD code:\n\`\`\`openscad\n${input.currentCode}\n\`\`\`\n\nUser request: ${input.message}`
          : `User request: ${input.message}`;

        const result = await genAI.models.generateContent({
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
        return result.text?.replace(/```openscad\s*/gi, '')?.replace(/```\s*/g, '')?.trim() || '';
      }),

    projects: createTRPCRouter({
      list: protectedProcedure
        .query(async ({ ctx }) => {
          return await db.query<ProjectRow>(
            `SELECT id, title, code, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC`,
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
            `SELECT id, title, code, created_at, updated_at FROM projects WHERE id = ?`,
            [id]
          );
          return project;
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.string(),
          title: z.string().min(1).max(100).optional(),
          code: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const sets: string[] = [];
          const params: unknown[] = [];
          if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
          if (input.code !== undefined) { sets.push('code = ?'); params.push(input.code); }
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
