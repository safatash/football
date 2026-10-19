import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      playerId?: string
      isCaptain?: boolean
      isAdmin?: boolean
      /** OWNER, ADMIN or STAFF: can open the league office (STAFF read-only) */
      canViewOffice?: boolean
      orgRole?: "OWNER" | "ADMIN" | "STAFF" | "PLAYER" | null
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