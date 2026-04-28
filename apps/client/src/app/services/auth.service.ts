import { Injectable, signal, computed } from '@angular/core';
import { createAuthClient } from 'better-auth/client';
import { passkeyClient } from 'better-auth/client/plugins';

const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [passkeyClient()],
});

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private sessionSignal = signal<typeof authClient.$Infer.Session | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this.sessionSignal()?.user);

  constructor() {
    this.refreshSession();
  }

  async refreshSession() {
    const { data } = await authClient.getSession();
    this.sessionSignal.set(data);
  }

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name,
    });
    if (error) throw error;
    await this.refreshSession();
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await authClient.signIn.email({
      email,
      password,
    });
    if (error) throw error;
    await this.refreshSession();
    return data;
  }

  async signInWithProvider(provider: 'github' | 'google') {
    const { data, error } = await authClient.signIn.social({
      provider,
      callbackURL: window.location.origin,
    });
    if (error) throw error;
    return data;
  }

  async signInWithPasskey() {
    const result = await authClient.signIn.passkey();
    if (result?.error) throw result.error;
    await this.refreshSession();
    return result?.data;
  }

  async addPasskey(name?: string) {
    const result = await authClient.passkey.addPasskey({ name });
    if (result?.error) throw result.error;
    return result?.data;
  }

  async listPasskeys() {
    const { data, error } = await authClient.passkey.listUserPasskeys();
    if (error) throw error;
    return data ?? [];
  }

  async deletePasskey(id: string) {
    const { error } = await authClient.passkey.deletePasskey({ id });
    if (error) throw error;
  }

  async signOut() {
    await authClient.signOut();
    this.sessionSignal.set(null);
  }
}
