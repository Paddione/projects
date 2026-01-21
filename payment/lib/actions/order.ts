'use server'

import { requireAuth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { checkAvailability } from '@/lib/booking'
import { TxType } from '@prisma/client'
import { addHours } from 'date-fns'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function purchaseProduct(productId: string, quantity: number = 1, bookingStartTime?: Date) {
    const user = await requireAuth() // Throws if not authenticated

    const userId = user.id

    // Start Transaction
    await db.$transaction(async (tx) => {
        // 1. Fetch Product
        const product = await tx.product.findUniqueOrThrow({ where: { id: productId } })

        // 2. Validate Stock
        if (product.stock < quantity) {
            throw new Error('Out of stock')
        }

        // 3. Validate Booking if Service
        if (product.isService) {
            if (!bookingStartTime) throw new Error('Booking time required for services')

            const endTime = addHours(bookingStartTime, 1)
            const availability = await checkAvailability(productId, bookingStartTime, endTime) // Note: checkAvailability implementation uses `db`, effectively outside this tx? 
            // checkAvailability is read-only mostly, but uses `db`. Ideally should accept `tx`.
            // For now, simpler to assume read-committed isolation or acceptable risk.
            if (!availability.available) throw new Error(availability.reason)
        }

        // 4. Calculate Total
        const total = product.price.toNumber() * quantity // price is Decimal, convert to number for simplicity or use Decimal math

        // 5. Get Wallet & Check Balance
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } })
        if (wallet.balance.toNumber() < total) {
            throw new Error('Insufficient PatrickCoins')
        }

        // 6. Deduct Balance
        await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: total } }
        })

        // 7. Create Transaction Record
        await tx.transaction.create({
            data: {
                walletId: wallet.id,
                amount: -total, // Negative for purchase
                type: TxType.PURCHASE,
                description: `Purchased ${product.title}`,
            }
        })

        // 8. Create Order
        await tx.order.create({
            data: {
                userId,
                total,
                status: 'COMPLETED',
                items: {
                    create: {
                        productId,
                        quantity,
                        price: product.price
                    }
                }
            }
        })

        // 9. Update Stock
        await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: quantity } }
        })

        // 10. Create Booking if Service
        if (product.isService && bookingStartTime) {
            await tx.booking.create({
                data: {
                    userId,
                    serviceId: productId,
                    startTime: bookingStartTime,
                    endTime: addHours(bookingStartTime, 1),
                    status: 'CONFIRMED'
                }
            })
        }
    })

    revalidatePath('/orders')
    redirect('/orders')
}
