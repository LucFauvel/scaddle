import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db";
import { passkey } from "better-auth/plugins/passkey";
import { database } from "./db";

const baseURL = process.env['BETTER_AUTH_URL'] || 'http://localhost:3000';
const rpID    = new URL(baseURL).hostname;

const authOptions = {
  database: database,
  secret: process.env['BETTER_AUTH_SECRET'],
  baseURL,
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env['GITHUB_CLIENT_ID'] as string,
      clientSecret: process.env['GITHUB_CLIENT_SECRET'] as string,
    },
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] as string,
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] as string,
    },
  },
  plugins: [
    passkey({
      rpName:    'Scaddle',
      rpID,
      origin:    baseURL,
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authOptions);

export async function runMigrations() {
  const { runMigrations: migrate } = await getMigrations(authOptions);
  await migrate();
}
