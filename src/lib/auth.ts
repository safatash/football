import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { Adapter } from "next-auth/adapters"
import { isAdminEmail } from "@/lib/admin"

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
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { player: true }
        })

        if (!user) {
          throw new Error("No user found with this email")
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error("Invalid password")
        }

        // Check if player account is active
        if (user.player && user.player.status !== "ACTIVE") {
          throw new Error("Account is not active")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.player ? `${user.player.firstName} ${user.player.lastName}` : user.email,
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        
        // Fetch player data and role
        const user = await prisma.user.findUnique({
          where: { id: token.sub as string },
          include: {
            player: {
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

        session.user.isAdmin = isAdminEmail(user?.email)
        if (user?.player) {
          session.user.playerId = user.player.id
          session.user.name = `${user.player.firstName} ${user.player.lastName}`
          session.user.isCaptain = user.player.teamMemberships.length > 0
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