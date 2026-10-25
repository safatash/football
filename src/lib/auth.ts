import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db";
import { canViewOffice, isOfficeRole } from "@/lib/access"
import { consumeToken } from "@/lib/tokens"
import { canSignIn, currentOrgIdOrNull, effectiveRole, platformFlags, userByEmail, userById } from "@/platform/identity"
import { LIMITS, clientIp, hitAll, rateKey } from "@/platform/rate-limit"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }
        // Slows down password guessing: per address and per email (the form explains RATE_LIMITED)
        const limited = await hitAll([
          [rateKey("login-ip", await clientIp()), LIMITS.loginIp],
          [rateKey("login-email", credentials.email), LIMITS.loginEmail],
        ])
        if (!limited.ok) throw new Error("RATE_LIMITED")
        const orgId = await currentOrgIdOrNull()
        const user = await userByEmail(credentials.email, orgId)
        if (!user) throw new Error("No user found with this email")
        if (!(await bcrypt.compare(credentials.password, user.password))) throw new Error("Invalid password")
        // Logins are per league: you need a membership here (the operator can sign in anywhere)
        if (!(await canSignIn(user, orgId))) throw new Error("No user found with this email")
        // Inactive accounts can't sign in; suspended players can (they see their status)
        if (user.players[0]?.status === "INACTIVE") throw new Error("Account is not active")
        return { id: user.id, email: user.email, name: user.players[0] ? `${user.players[0].firstName} ${user.players[0].lastName}` : user.email }
      }
    }),
    // "Email me a login link": a single-use token from /login/link signs the user in
    CredentialsProvider({
      id: "login-link",
      name: "login link",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        const userId = await consumeToken("login", credentials?.token ?? "")
        if (!userId) throw new Error("This login link has expired or was already used.")
        const orgId = await currentOrgIdOrNull()
        const user = await userById(userId, orgId)
        if (!user || user.players[0]?.status === "INACTIVE") throw new Error("This account isn’t active.")
        if (!(await canSignIn(user, orgId))) throw new Error("This account isn’t active.")
        return { id: user.id, email: user.email, name: user.players[0] ? `${user.players[0].firstName} ${user.players[0].lastName}` : user.email }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        
        const flags = await platformFlags(token.sub as string)
        session.user.isPlatformAdmin = !!flags?.isPlatformAdmin
        // League-specific: role (membership, or the operator impersonating), player profile and captaincy
        const orgId = await currentOrgIdOrNull()
        session.user.isAdmin = false
        session.user.canViewOffice = false
        session.user.impersonating = false
        if (orgId) {
          const [role, player] = await Promise.all([
            effectiveRole(token.sub as string, orgId),
            db.player.findFirst({
              where: { userId: token.sub as string },
              include: { teamMemberships: { where: { isCaptain: true, leftAt: null } } },
            }),
          ])
          session.user.isAdmin = isOfficeRole(role?.role)
          session.user.canViewOffice = canViewOffice(role?.role)
          session.user.orgRole = role?.role ?? null
          session.user.impersonating = !!role?.impersonating
          if (player) {
            session.user.playerId = player.id
            session.user.name = `${player.firstName} ${player.lastName}`
            session.user.isCaptain = player.teamMemberships.length > 0
          }
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}