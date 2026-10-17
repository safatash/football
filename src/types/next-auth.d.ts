import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      playerId?: string
      isCaptain?: boolean
      isAdmin?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    playerId?: string
    isCaptain?: boolean
    isAdmin?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    playerId?: string
    isCaptain?: boolean
    isAdmin?: boolean
  }
}