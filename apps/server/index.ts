import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { publicProcedure, router } from './trpc';
import z from 'zod';
import cors from 'cors';
 
const appRouter = router({
  askChat: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      // Simulate a chat response
      return `You asked: ${input}`;
    })
});

export type AppRouter = typeof appRouter;

const server = createHTTPServer({
  middleware: cors(),
  router: appRouter,
});
 
server.listen(3000);

