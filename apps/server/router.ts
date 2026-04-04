import { publicProcedure, createTRPCRouter } from './trpc';
import z from 'zod';

interface GenAI {
  models: {
    generateContent(opts: {
      model: string;
      contents: string;
      config: { systemInstruction: string[] };
    }): Promise<{ text?: string }>;
  };
}

export const createAppRouter = (genAI: GenAI) =>
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
      })
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
