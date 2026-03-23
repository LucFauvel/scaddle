import { createTRPCClient, httpBatchLink, TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../../../server/router';
import { Injectable } from '@angular/core';

@Injectable({providedIn: 'root'})
export class TrpcService {
  private readonly client: TRPCClient<AppRouter>;

  constructor() {
    this.client = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000',
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      ],
    });
  }

  // Example method to demonstrate service functionality
  async ask(message: string, currentCode: string): Promise<string | undefined> {
    return await this.client.askChat.query({ message, currentCode });
  }
}
