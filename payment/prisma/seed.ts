import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const passwordHash = await bcrypt.hash('P@trickC0inAdmin2025!', 10)

    // Master Account
    const admin = await prisma.user.upsert({
        where: { email: 'admin@patrickcoin.com' },
        update: { passwordHash },
        create: {
            email: 'admin@patrickcoin.com',
            name: 'Patrick Master',
            role: 'ADMIN',
            passwordHash,
            wallet: {
                create: {
                    balance: 999999
                }
            }
        },
    })

    // Standard User
    const user = await prisma.user.upsert({
        where: { email: 'user@example.com' },
        update: {},
        create: {
            email: 'user@example.com',
            name: 'Test User',
            role: 'USER',
            passwordHash,
            wallet: {
                create: {
                    balance: 100
                }
            }
        },
    })

    console.log({ admin, user })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
