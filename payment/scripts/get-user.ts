
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst({
        include: { wallet: true }
    })
    if (user) {
        console.log('User ID:', user.id)
        if (user.wallet) {
            console.log('Wallet ID:', user.wallet.id)
        } else {
            console.log('User has no wallet.')
        }
    } else {
        console.log('No users found.')
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
