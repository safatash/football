import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { Adapter } from "next-auth/adapters"
import { isAdminUser } from "@/lib/admin"
import { playerInOrg } from "@/lib/org"
import { consumeToken } from "@/lib/tokens"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
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
        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email.trim(), mode: "insensitive" } },
          include: { players: playerInOrg() }
        })

        if (!user) {
          throw new Error("No user found with this email")
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error("Invalid password")
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
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { players: playerInOrg() } })
        if (!user || user.players[0]?.status === "INACTIVE") throw new Error("This account isn’t active.")
        return { id: user.id, email: user.email, name: user.players[0] ? `${user.players[0].firstName} ${user.players[0].lastName}` : user.email }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        
        // Fetch player data and role
        const user = await prisma.user.findUnique({
          where: { id: token.sub as string },
          include: {
            players: {
              ...playerInOrg(),
              include: {
                teamMemberships: {
                  where: { 
                    isCaptain: true,
                    leftAt: null
                  }
                }
              }
            }
          }
        })

        session.user.isAdmin = isAdminUser(user)
        if (user?.players[0]) {
          session.user.playerId = user.players[0].id
          session.user.name = `${user.players[0].firstName} ${user.players[0].lastName}`
          session.user.isCaptain = user.players[0].teamMemberships.length > 0
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