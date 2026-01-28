import { PrismaClient } from '@prisma/client'

const DEFAULT_DATABASE_URL = 'postgresql://payment_user:2e67a4d8576773457fcaac19b3de8b1c@localhost:5432/payment_test?schema=public'

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL
}

async function withClient<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    const prisma = new PrismaClient()
    try {
        return await fn(prisma)
    } finally {
        await prisma.$disconnect()
    }
}

export async function ensureProductSeed() {
    return withClient(async (prisma) => {
        const existing = await prisma.product.findFirst({
            where: {
                title: {
                    startsWith: 'E2E Product',
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        if (existing) {
            return existing
        }

        return prisma.product.create({
            data: {
                title: `E2E Product ${Date.now()}`,
                description: 'E2E seeded product for Playwright tests.',
                price: 10,
                stock: 5,
                isService: false,
            },
        })
    })
}

export async function getSeedProductId() {
    return withClient(async (prisma) => {
        const existing = await prisma.product.findFirst({
            where: {
                title: {
                    startsWith: 'E2E Product',
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        return existing?.id || null
    })
}

export async function cleanupSeedProducts() {
    return withClient(async (prisma) => {
        await prisma.product.deleteMany({
            where: {
                title: {
                    startsWith: 'E2E Product',
                },
            },
        })
    })
}
