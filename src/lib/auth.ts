import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db";
import { isOfficeRole } from "@/lib/access"
import { getOrgId, playerInOrg } from "@/lib/org"
import { consumeToken } from "@/lib/tokens"

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

        // Find user with player profile
        const user = await db.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
          include: { players: playerInOrg(await getOrgId()) }
        })

        if (!user) {
          throw new Error("No user found with this email")
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error("Invalid password")
        }

        // Logins are per league: you need a membership here (platform operators can sign in anywhere)
        if (!user.isPlatformAdmin && !(await db.organizationMember.findFirst({ where: { userId: user.id, status: "ACTIVE" } }))) {
          throw new Error("No user found with this email")
        }

        // Inactive accounts can't sign in; suspended players can (they see their status)
        if (user.players[0] && user.players[0].status === "INACTIVE") {
          throw new Error("Account is not active")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.players[0] ? `${user.players[0].firstName} ${user.players[0].lastName}` : user.email,
        }
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
        const user = await db.user.findUnique({ where: { id: userId }, include: { players: playerInOrg(await getOrgId()) } })
        if (!user || user.players[0]?.status === "INACTIVE") throw new Error("This account isn’t active.")
        if (!user.isPlatformAdmin && !(await db.organizationMember.findFirst({ where: { userId: user.id, status: "ACTIVE" } }))) throw new Error("This account isn’t active.")
        return { id: user.id, email: user.email, name: user.players[0] ? `${user.players[0].firstName} ${user.players[0].lastName}` : user.email }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        
        // League-specific: membership role, player profile and captaincy in the current league
        let orgId: string | null = null
        try {
          orgId = await getOrgId()
        } catch {
          // A platform route (no league): nothing league-specific in the session
        }
        if (orgId) {
          const [member, player] = await Promise.all([
            db.organizationMember.findFirst({ where: { userId: token.sub as string, status: "ACTIVE" } }),
            db.player.findFirst({
              where: { userId: token.sub as string },
              include: { teamMemberships: { where: { isCaptain: true, leftAt: null } } },
            }),
          ])
          session.user.isAdmin = isOfficeRole(member?.role)
          session.user.orgRole = member?.role ?? null
          if (player) {
            session.user.playerId = player.id
            session.user.name = `${player.firstName} ${player.lastName}`
            session.user.isCaptain = player.teamMemberships.length > 0
          }
        } else {
          session.user.isAdmin = false
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