
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'user@example.com';
    const password = 'password';
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (!existingUser) {
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name: 'Test User',
                role: 'USER',
                wallet: {
                    create: {
                        balance: 0,
                    }
                }
            },
            include: { wallet: true }
        });
        console.log(`Created user: ${user.email}, ID: ${user.id}, Wallet ID: ${user.wallet?.id}`);
    } else {
        console.log(`User already exists: ${existingUser.email}, ID: ${existingUser.id}`);
        // Ensure wallet exists
        const wallet = await prisma.wallet.findUnique({ where: { userId: existingUser.id } });
        if (!wallet) {
            const newWallet = await prisma.wallet.create({
                data: { userId: existingUser.id, balance: 0 }
            });
            console.log(`Created wallet for existing user: ${newWallet.id}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
