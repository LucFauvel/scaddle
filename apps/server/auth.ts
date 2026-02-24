import { betterAuth } from "better-auth";
import { database } from "./db";

export const auth = betterAuth({
  database: database,
  secret: process.env['BETTER_AUTH_SECRET'],
  baseURL: process.env['BETTER_AUTH_URL'] || 'http://localhost:3000',
  trustedOrigins: [
    'http://localhost:4200',
    'http://localhost:3000',
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
});
