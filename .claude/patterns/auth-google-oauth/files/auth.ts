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
    // Expose the DB user.id on the client-accessible session object
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
