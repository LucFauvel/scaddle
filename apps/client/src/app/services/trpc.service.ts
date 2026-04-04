import { createTRPCClient, httpBatchLink, TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../../../server/router';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({providedIn: 'root'})
export class TrpcService {
  private readonly client: TRPCClient<AppRouter>;

  constructor() {
    this.client = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: environment.apiUrl,
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
