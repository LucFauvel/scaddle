import { Injectable, signal, computed } from '@angular/core';
import { createAuthClient } from 'better-auth/client';

const authClient = createAuthClient({
  baseURL: 'http://localhost:3000',
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

  async signOut() {
    await authClient.signOut();
    this.sessionSignal.set(null);
  }
}
