import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Prisma mock setup ---
const mockWalletFindUnique = vi.fn()
const mockWalletCreate = vi.fn()
const mockWalletUpdate = vi.fn()
const mockTransactionCreate = vi.fn()

const mockTx = {
    wallet: {
        findUnique: mockWalletFindUnique,
        create: mockWalletCreate,
        update: mockWalletUpdate,
    },
    transaction: {
        create: mockTransactionCreate,
    },
}

vi.mock('@/lib/db', () => ({
    db: {
        $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => {
            await fn(mockTx)
        }),
    },
}))

// Mock TxType enum since Prisma client may not be generated in test env
vi.mock('@prisma/client', () => ({
    TxType: {
        DEPOSIT: 'DEPOSIT',
        PURCHASE: 'PURCHASE',
        ADJUSTMENT: 'ADJUSTMENT',
        REFUND: 'REFUND',
    },
}))

import { processTransaction } from '@/lib/ledger'
import { db } from '@/lib/db'

describe('processTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates a new wallet when none exists and records the transaction', async () => {
        const newWallet = { id: 'wallet-1', userId: 'user-1', balance: 0 }

        mockWalletFindUnique.mockResolvedValue(null)
        mockWalletCreate.mockResolvedValue(newWallet)
        mockWalletUpdate.mockResolvedValue({ ...newWallet, balance: 50 })
        mockTransactionCreate.mockResolvedValue({})

        await processTransaction({
            userId: 'user-1',
            amount: 50,
            type: 'DEPOSIT' as any,
            description: 'Initial deposit',
        })

        expect(db.$transaction).toHaveBeenCalledOnce()

        // Should look up wallet by userId
        expect(mockWalletFindUnique).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
        })

        // Should create wallet since none exists
        expect(mockWalletCreate).toHaveBeenCalledWith({
            data: { userId: 'user-1', balance: 0 },
        })

        // Should increment balance on the newly created wallet
        expect(mockWalletUpdate).toHaveBeenCalledWith({
            where: { id: 'wallet-1' },
            data: { balance: { increment: 50 } },
        })

        // Should create transaction record
        expect(mockTransactionCreate).toHaveBeenCalledWith({
            data: {
                walletId: 'wallet-1',
                amount: 50,
                type: 'DEPOSIT',
                referenceId: undefined,
                description: 'Initial deposit',
            },
        })
    })

    it('uses existing wallet for deposit without creating a new one', async () => {
        const existingWallet = { id: 'wallet-2', userId: 'user-2', balance: 100 }

        mockWalletFindUnique.mockResolvedValue(existingWallet)
        mockWalletUpdate.mockResolvedValue({ ...existingWallet, balance: 125 })
        mockTransactionCreate.mockResolvedValue({})

        await processTransaction({
            userId: 'user-2',
            amount: 25,
            type: 'DEPOSIT' as any,
            referenceId: 'stripe-pi-123',
            description: 'Top-up',
        })

        // Should NOT create a new wallet
        expect(mockWalletCreate).not.toHaveBeenCalled()

        // Should increment on the existing wallet
        expect(mockWalletUpdate).toHaveBeenCalledWith({
            where: { id: 'wallet-2' },
            data: { balance: { increment: 25 } },
        })

        // Should record the transaction with referenceId
        expect(mockTransactionCreate).toHaveBeenCalledWith({
            data: {
                walletId: 'wallet-2',
                amount: 25,
                type: 'DEPOSIT',
                referenceId: 'stripe-pi-123',
                description: 'Top-up',
            },
        })
    })

    it('handles purchase (negative amount) on existing wallet', async () => {
        const existingWallet = { id: 'wallet-3', userId: 'user-3', balance: 200 }

        mockWalletFindUnique.mockResolvedValue(existingWallet)
        mockWalletUpdate.mockResolvedValue({ ...existingWallet, balance: 150 })
        mockTransactionCreate.mockResolvedValue({})

        await processTransaction({
            userId: 'user-3',
            amount: -50,
            type: 'PURCHASE' as any,
            description: 'Bought item',
        })

        expect(mockWalletUpdate).toHaveBeenCalledWith({
            where: { id: 'wallet-3' },
            data: { balance: { increment: -50 } },
        })

        expect(mockTransactionCreate).toHaveBeenCalledWith({
            data: {
                walletId: 'wallet-3',
                amount: -50,
                type: 'PURCHASE',
                referenceId: undefined,
                description: 'Bought item',
            },
        })
    })

    it('propagates errors from the Prisma transaction', async () => {
        const dbMock = vi.mocked(db.$transaction)
        dbMock.mockRejectedValueOnce(new Error('DB connection failed'))

        await expect(
            processTransaction({
                userId: 'user-4',
                amount: 10,
                type: 'DEPOSIT' as any,
            })
        ).rejects.toThrow('DB connection failed')
    })

    it('handles refund transaction type', async () => {
        const existingWallet = { id: 'wallet-5', userId: 'user-5', balance: 50 }

        mockWalletFindUnique.mockResolvedValue(existingWallet)
        mockWalletUpdate.mockResolvedValue({ ...existingWallet, balance: 80 })
        mockTransactionCreate.mockResolvedValue({})

        await processTransaction({
            userId: 'user-5',
            amount: 30,
            type: 'REFUND' as any,
            referenceId: 'order-456',
            description: 'Refund for cancelled order',
        })

        expect(mockWalletUpdate).toHaveBeenCalledWith({
            where: { id: 'wallet-5' },
            data: { balance: { increment: 30 } },
        })

        expect(mockTransactionCreate).toHaveBeenCalledWith({
            data: {
                walletId: 'wallet-5',
                amount: 30,
                type: 'REFUND',
                referenceId: 'order-456',
                description: 'Refund for cancelled order',
            },
        })
    })

    it('passes optional fields as undefined when not provided', async () => {
        const existingWallet = { id: 'wallet-6', userId: 'user-6', balance: 0 }

        mockWalletFindUnique.mockResolvedValue(existingWallet)
        mockWalletUpdate.mockResolvedValue({ ...existingWallet, balance: 100 })
        mockTransactionCreate.mockResolvedValue({})

        await processTransaction({
            userId: 'user-6',
            amount: 100,
            type: 'ADJUSTMENT' as any,
        })

        expect(mockTransactionCreate).toHaveBeenCalledWith({
            data: {
                walletId: 'wallet-6',
                amount: 100,
                type: 'ADJUSTMENT',
                referenceId: undefined,
                description: undefined,
            },
        })
    })
})
