import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const passwordHash = await bcrypt.hash('G0ldC0insAdmin2025!', 10)

    // Master Account
    const admin = await prisma.user.upsert({
        where: { email: 'admin@goldcoins.shop' },
        update: { passwordHash },
        create: {
            email: 'admin@goldcoins.shop',
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

    // Create Products
    const products = [
        {
            title: 'Gold Coin Collectible',
            description: 'A physical representation of your digital wealth. Minted in 24k gold.',
            price: 5000,
            stock: 10,
            isService: false,
            imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=400'
        },
        {
            title: 'Silver Membership Card',
            description: 'Exclusive membership card for high-net-worth individuals.',
            price: 2500,
            stock: 50,
            isService: false,
            imageUrl: 'https://images.unsplash.com/photo-1549421263-5ec394a5ad4c?auto=format&fit=crop&q=80&w=400'
        },
        {
            title: 'Personal Financial Consulting',
            description: '1-hour session with a financial expert to optimize your digital assets.',
            price: 1500,
            stock: 100,
            isService: true,
            imageUrl: 'https://images.unsplash.com/photo-1454165833767-027ffea7021b?auto=format&fit=crop&q=80&w=400'
        }
    ]

    for (const product of products) {
        await prisma.product.create({
            data: product
        })
    }

    console.log({ admin, user, productCount: products.length })
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
