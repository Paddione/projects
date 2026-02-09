import { db } from '@/lib/db'
import { TxType } from '@prisma/client'

export async function processTransaction({
    userId,
    amount,
    type,
    referenceId,
    description,
}: {
    userId: string
    amount: number
    type: TxType
    referenceId?: string
    description?: string
}) {
    await db.$transaction(async (tx) => {
        let wallet = await tx.wallet.findUnique({ where: { userId } })
        if (!wallet) {
            wallet = await tx.wallet.create({ data: { userId, balance: 0 } })
        }

        await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: amount } },
        })

        await tx.transaction.create({
            data: {
                walletId: wallet.id,
                amount,
                type,
                referenceId,
                description,
            },
        })
    })
}
