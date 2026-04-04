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

  async ask(message: string, currentCode: string): Promise<string | undefined> {
    return await this.client.askChat.query({ message, currentCode });
  }

  async projectList() {
    return this.client.projects.list.query();
  }

  async projectCreate(title: string, initialCode: string) {
    return this.client.projects.create.mutate({ title, initialCode });
  }

  async projectUpdate(id: string, data: { title?: string; code?: string; chat?: string }) {
    return this.client.projects.update.mutate({ id, ...data });
  }

  async projectDelete(id: string) {
    return this.client.projects.delete.mutate({ id });
  }

  async settingsHasApiKey(): Promise<boolean> {
    return this.client.settings.hasApiKey.query();
  }

  async settingsSetApiKey(apiKey: string): Promise<void> {
    return this.client.settings.setApiKey.mutate({ apiKey });
  }

  async settingsClearApiKey(): Promise<void> {
    return this.client.settings.clearApiKey.mutate();
  }
}
