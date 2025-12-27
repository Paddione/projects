import { db } from '@/lib/db';
import { TxType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export async function processTransaction({
    userId,
    amount,
    type,
    referenceId,
    description,
}: {
    userId: string;
    amount: number; // Positive or Negative
    type: TxType;
    referenceId?: string;
    description?: string;
}) {
    return await db.$transaction(async (tx) => {
        // 1. Get Wallet
        const wallet = await tx.wallet.findUnique({
            where: { userId },
        });

        if (!wallet) {
            throw new Error('Wallet not found for user');
        }

        // 2. Check Insufficient Funds for deductions
        if (amount < 0) {
            if (wallet.balance.toNumber() < Math.abs(amount)) {
                throw new Error('Insufficient funds');
            }
        }

        // 3. Create Transaction Record
        const transaction = await tx.transaction.create({
            data: {
                walletId: wallet.id,
                amount: new Decimal(amount),
                type,
                referenceId,
                description,
            },
        });

        // 4. Update Wallet Balance
        const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
                balance: {
                    increment: amount,
                },
            },
        });

        return { transaction, newBalance: updatedWallet.balance };
    });
}
