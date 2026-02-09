import { DefaultSession } from "next-auth"
import { Role } from "@prisma/client"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: Role
        } & DefaultSession["user"]
    }

    interface User {
        role: Role
        authUserId?: number
        accessToken?: string
        refreshToken?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role: Role
        id: string
        authUserId?: number
        accessToken?: string
        refreshToken?: string
    }
}
