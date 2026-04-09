import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db";
import { database } from "./db";

const authOptions = {
  database: database,
  secret: process.env['BETTER_AUTH_SECRET'],
  baseURL: process.env['BETTER_AUTH_URL'] || 'http://localhost:3000',
  trustedOrigins: [
    process.env['BETTER_AUTH_URL'] || 'http://localhost:3000',
  ],
  emailAndPassword: {
    enabled: true,
  },
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
