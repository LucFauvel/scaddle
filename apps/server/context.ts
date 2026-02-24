import { auth } from './auth'
import type { TRPCContext } from './trpc'

export const createTRPCContext = async (opts: { headers: Headers }): Promise<TRPCContext> => {
  const authSession = await auth.api.getSession({
    headers: opts.headers
  })

  const source = opts.headers.get('x-trpc-source') ?? 'unknown'
  console.log('>>> tRPC Request from', source, 'by', authSession?.user.email)

  return {
    user: authSession?.user
  }
}
