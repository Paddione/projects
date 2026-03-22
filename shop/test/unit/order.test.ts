import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be declared before importing the module under test) ──

// Mock tx sub-objects — reused inside $transaction
const mockProductFindUniqueOrThrow = vi.fn()
const mockProductUpdateMany = vi.fn()
const mockWalletFindUniqueOrThrow = vi.fn()
const mockWalletUpdate = vi.fn()
const mockTransactionCreate = vi.fn()
const mockOrderCreate = vi.fn()
const mockBookingCreate = vi.fn()
const mockUserFindMany = vi.fn()
const mockNotificationCreateMany = vi.fn()

const mockTx = {
    product: {
        findUniqueOrThrow: mockProductFindUniqueOrThrow,
        updateMany: mockProductUpdateMany,
    },
    wallet: {
        findUniqueOrThrow: mockWalletFindUniqueOrThrow,
        update: mockWalletUpdate,
    },
    transaction: {
        create: mockTransactionCreate,
    },
    order: {
        create: mockOrderCreate,
    },
    booking: {
        create: mockBookingCreate,
    },
    user: {
        findMany: mockUserFindMany,
    },
    notification: {
        createMany: mockNotificationCreateMany,
    },
}

vi.mock('@/lib/db', () => ({
    db: {
        $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => {
            await fn(mockTx)
        }),
    },
}))

vi.mock('@/lib/actions/auth', () => ({
    requireAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new RedirectError(url)
    }),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

vi.mock('@/lib/booking', () => ({
    checkAvailability: vi.fn(),
}))

vi.mock('@prisma/client', () => ({
    TxType: {
        DEPOSIT: 'DEPOSIT',
        PURCHASE: 'PURCHASE',
        ADJUSTMENT: 'ADJUSTMENT',
        REFUND: 'REFUND',
    },
    NotificationType: {
        PURCHASE: 'PURCHASE',
        INFO: 'INFO',
    },
}))

// Helper class to identify redirect throws in tests
class RedirectError extends Error {
    url: string
    constructor(url: string) {
        super(`NEXT_REDIRECT: ${url}`)
        this.url = url
    }
}

// ── Imports (after mocks) ──

import { purchaseProduct } from '@/lib/actions/order'
import { requireAuth } from '@/lib/actions/auth'
import { checkAvailability } from '@/lib/booking'
import { revalidatePath } from 'next/cache'

// ── Helpers ──

function makeProduct(overrides: object = {}) {
    return {
        id: 'prod-1',
        title: 'Test Product',
        price: { toNumber: () => 10 },
        stock: 5,
        isService: false,
        ...overrides,
    }
}

function makeWallet(overrides: object = {}) {
    return {
        id: 'wallet-1',
        userId: 'user-1',
        balance: { toNumber: () => 100 },
        ...overrides,
    }
}

const mockUser = { id: 'user-1', email: 'buyer@example.com', name: 'Buyer', role: 'USER' as const }

// ── Tests ──

describe('purchaseProduct', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default happy-path setup
        vi.mocked(requireAuth).mockResolvedValue(mockUser as any)
        mockProductFindUniqueOrThrow.mockResolvedValue(makeProduct())
        mockProductUpdateMany.mockResolvedValue({ count: 1 })
        mockWalletFindUniqueOrThrow.mockResolvedValue(makeWallet())
        mockWalletUpdate.mockResolvedValue({})
        mockTransactionCreate.mockResolvedValue({})
        mockOrderCreate.mockResolvedValue({})
        mockUserFindMany.mockResolvedValue([])
    })

    // 1. Throws when not authenticated
    it('throws when requireAuth rejects (not authenticated)', async () => {
        vi.mocked(requireAuth).mockRejectedValue(new Error('Not authenticated'))

        await expect(purchaseProduct('prod-1')).rejects.toThrow('Not authenticated')
    })

    // 2. Throws on invalid quantity
    it('throws on quantity of 0', async () => {
        await expect(purchaseProduct('prod-1', 0)).rejects.toThrow('Invalid quantity')
    })

    it('throws on negative quantity', async () => {
        await expect(purchaseProduct('prod-1', -1)).rejects.toThrow('Invalid quantity')
    })

    it('throws on fractional quantity', async () => {
        await expect(purchaseProduct('prod-1', 1.5)).rejects.toThrow('Invalid quantity')
    })

    // 3. Throws when out of stock (updateMany returns count: 0)
    it('throws "Out of stock" when updateMany returns count 0', async () => {
        mockProductUpdateMany.mockResolvedValue({ count: 0 })

        await expect(purchaseProduct('prod-1', 1)).rejects.toThrow('Out of stock')
    })

    // 4. Throws on insufficient balance
    it('throws "Insufficient GoldCoins" when wallet balance is too low', async () => {
        mockProductFindUniqueOrThrow.mockResolvedValue(makeProduct({ price: { toNumber: () => 200 } }))
        mockWalletFindUniqueOrThrow.mockResolvedValue(makeWallet({ balance: { toNumber: () => 50 } }))

        await expect(purchaseProduct('prod-1', 1)).rejects.toThrow('Insufficient GoldCoins')
    })

    // 5. Creates order with correct total (price × quantity)
    it('creates order with correct total (price × quantity)', async () => {
        // price=10, quantity=3 → total=30
        mockProductFindUniqueOrThrow.mockResolvedValue(makeProduct({ price: { toNumber: () => 10 } }))

        // Redirect is thrown after success, so catch it
        await expect(purchaseProduct('prod-1', 3)).rejects.toThrow(RedirectError)

        expect(mockOrderCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    total: 30,
                    status: 'COMPLETED',
                }),
            })
        )
    })

    it('redirects to /orders after successful purchase', async () => {
        let redirectUrl: string | undefined
        try {
            await purchaseProduct('prod-1', 1)
        } catch (e) {
            if (e instanceof RedirectError) redirectUrl = e.url
            else throw e
        }
        expect(redirectUrl).toBe('/orders')
        expect(revalidatePath).toHaveBeenCalledWith('/orders')
    })

    // 6. Throws when booking time missing for service product
    it('throws "Booking time required for services" when isService=true and no bookingStartTime', async () => {
        mockProductFindUniqueOrThrow.mockResolvedValue(makeProduct({ isService: true }))

        await expect(purchaseProduct('prod-1', 1)).rejects.toThrow('Booking time required for services')
    })

    // 7. Handles service product with booking time
    it('creates booking record for service product when bookingStartTime provided', async () => {
        const bookingStartTime = new Date('2026-04-01T10:00:00Z')
        mockProductFindUniqueOrThrow.mockResolvedValue(makeProduct({ isService: true }))
        vi.mocked(checkAvailability).mockResolvedValue({ available: true } as any)

        await expect(purchaseProduct('prod-1', 1, bookingStartTime)).rejects.toThrow(RedirectError)

        expect(mockBookingCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 'user-1',
                    serviceId: 'prod-1',
                    startTime: bookingStartTime,
                    status: 'CONFIRMED',
                }),
            })
        )
    })

    it('throws when checkAvailability returns not available', async () => {
        const bookingStartTime = new Date('2026-04-01T10:00:00Z')
        mockProductFindUniqueOrThrow.mockResolvedValue(makeProduct({ isService: true }))
        vi.mocked(checkAvailability).mockResolvedValue({ available: false, reason: 'Slot taken' } as any)

        await expect(purchaseProduct('prod-1', 1, bookingStartTime)).rejects.toThrow('Slot taken')
    })

    it('notifies admins when admins exist', async () => {
        const admins = [{ id: 'admin-1' }, { id: 'admin-2' }]
        mockUserFindMany.mockResolvedValue(admins)

        await expect(purchaseProduct('prod-1', 1)).rejects.toThrow(RedirectError)

        expect(mockNotificationCreateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([
                    expect.objectContaining({ userId: 'admin-1' }),
                    expect.objectContaining({ userId: 'admin-2' }),
                ]),
            })
        )
    })

    it('skips notification when no admins exist', async () => {
        mockUserFindMany.mockResolvedValue([])

        await expect(purchaseProduct('prod-1', 1)).rejects.toThrow(RedirectError)

        expect(mockNotificationCreateMany).not.toHaveBeenCalled()
    })
})
