import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable:              users,
    accountsTable:           accounts,
    sessionsTable:           sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Explicit — NextAuth v5 silently defaults to "database" sessions the
  // moment an adapter is present, which costs a DB read on every
  // authenticated request. "jwt" avoids that. Only switch to "database" if
  // server-side session revocation becomes a real requirement, and note the
  // tradeoff here when you do. See this pattern's README "Lessons Learned".
  session: {
    strategy: 'jwt',
  },
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/', // redirect unauthenticated users to the login page
  },
  callbacks: {
    // Expose the DB user.id on the client-accessible session object.
    //
    // Under `strategy: 'jwt'`, @auth/core's session callback receives
    // { session, token } — NOT { session, user }. `user` is only passed
    // under `strategy: 'database'`. Destructuring `user` here previously
    // threw "Cannot read properties of undefined (reading 'id')" on every
    // real sign-in, which NextAuth silently caught as a JWTSessionError and
    // turned into a wiped session cookie — meaning no one could ever stay
    // signed in. `token.sub` already holds the user id (NextAuth sets it
    // from `user.id` automatically on initial sign-in), so no separate
    // `jwt` callback is needed to populate it.
    session({ session, token }) {
      session.user.id = token.sub as string;
      return session;
    },
  },
});
