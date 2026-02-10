'use server'

import { requireAuth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { checkAvailability } from '@/lib/booking'
import { TxType, NotificationType } from '@prisma/client'
import { addHours } from 'date-fns'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function purchaseProduct(productId: string, quantity: number = 1, bookingStartTime?: Date) {
    const user = await requireAuth() // Throws if not authenticated

    if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Invalid quantity')
    }

    const userId = user.id

    // Start Transaction
    await db.$transaction(async (tx) => {
        // 1. Fetch Product
        const product = await tx.product.findUniqueOrThrow({ where: { id: productId } })

        // 2. Validate Booking if Service
        if (product.isService) {
            if (!bookingStartTime) throw new Error('Booking time required for services')

            const endTime = addHours(bookingStartTime, 1)
            const availability = await checkAvailability(productId, bookingStartTime, endTime)
            if (!availability.available) throw new Error(availability.reason)
        }

        // 3. Calculate Total
        const total = product.price.toNumber() * quantity

        // 4. Atomically decrement stock (check + decrement in one query to prevent overselling)
        const stockUpdate = await tx.product.updateMany({
            where: { id: productId, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } }
        })
        if (stockUpdate.count === 0) {
            throw new Error('Out of stock')
        }

        // 5. Get Wallet & Check Balance
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } })
        if (wallet.balance.toNumber() < total) {
            throw new Error('Insufficient GoldCoins')
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

        // 11. Notify all admins about the purchase
        const admins = await tx.user.findMany({ where: { role: 'ADMIN' } })
        if (admins.length > 0) {
            await tx.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    type: NotificationType.PURCHASE,
                    message: `${user.name || user.email} purchased ${product.title} x${quantity} for ${total} GC`,
                    metadata: { productId, quantity, total, buyerEmail: user.email },
                })),
            })
        }
    })

    revalidatePath('/orders')
    redirect('/orders')
}
