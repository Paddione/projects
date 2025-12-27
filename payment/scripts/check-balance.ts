
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
    const userId = 'cmivf1t150002y9f1sokuvndn'
    const wallet = await prisma.wallet.findUnique({
        where: { userId }
    })
    console.log(`Wallet Balance for ${userId}:`, wallet?.balance?.toString() || 'Wallet not found')
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
