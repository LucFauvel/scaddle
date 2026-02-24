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
      .input(z.string())
      .query(async function ({ input }) {
        const result = await genAI.models.generateContent({
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

export type AppRouter = ReturnType<typeof createAppRouter>;
