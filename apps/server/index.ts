import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { router } from './trpc';
 
const appRouter = router({
  // ...
});
 
const server = createHTTPServer({
  router: appRouter,
});
 
server.listen(3000);

