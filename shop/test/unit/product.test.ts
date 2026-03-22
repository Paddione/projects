import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be declared before importing the module under test) ──
// Note: vi.mock factories are hoisted — cannot reference external variables.
// We retrieve mock fns via vi.mocked() after import.

vi.mock('@/lib/db', () => ({
    db: {
        product: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        orderItem: {
            count: vi.fn(),
        },
    },
}))

vi.mock('@/lib/actions/auth', () => ({
    requireAdmin: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new RedirectError(url)
    }),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
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

import { createProduct, updateProduct, deleteProduct } from '@/lib/actions/product'
import { requireAdmin } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ── Helpers ──

function makeFormData(entries: Record<string, string>): FormData {
    const fd = new FormData()
    for (const [key, value] of Object.entries(entries)) {
        fd.append(key, value)
    }
    return fd
}

function validProductFormData(overrides: Record<string, string> = {}): FormData {
    return makeFormData({
        title: 'Widget Pro',
        description: 'A great widget',
        price: '25',
        stock: '10',
        ...overrides,
    })
}

const mockAdmin = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const }

// ── Tests ──

describe('createProduct', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireAdmin).mockResolvedValue(mockAdmin as any)
        vi.mocked(db.product.create).mockResolvedValue({ id: 'prod-new' } as any)
    })

    // 1. createProduct — calls requireAdmin, validates, creates product
    it('calls requireAdmin, creates product with validated data, then redirects', async () => {
        const fd = validProductFormData()

        let redirectUrl: string | undefined
        try {
            await createProduct(fd)
        } catch (e) {
            if (e instanceof RedirectError) redirectUrl = e.url
            else throw e
        }

        expect(requireAdmin).toHaveBeenCalledOnce()
        expect(db.product.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                title: 'Widget Pro',
                description: 'A great widget',
                price: 25,
                stock: 10,
            }),
        })
        expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
        expect(redirectUrl).toBe('/admin/products')
    })

    it('sets isService to false when form checkbox is absent', async () => {
        const fd = validProductFormData()
        await expect(createProduct(fd)).rejects.toThrow(RedirectError)

        expect(db.product.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ isService: false }),
            })
        )
    })

    it('sets isService to true when form checkbox is "on"', async () => {
        const fd = validProductFormData({ isService: 'on' })
        await expect(createProduct(fd)).rejects.toThrow(RedirectError)

        expect(db.product.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ isService: true }),
            })
        )
    })

    // 2. createProduct — throws on invalid data (missing title)
    it('throws ZodError when title is missing', async () => {
        const fd = makeFormData({
            description: 'A great widget',
            price: '25',
            stock: '10',
        })

        await expect(createProduct(fd)).rejects.toThrow()
        expect(db.product.create).not.toHaveBeenCalled()
    })

    it('throws ZodError when description is missing', async () => {
        const fd = makeFormData({
            title: 'Widget',
            price: '25',
            stock: '10',
        })

        await expect(createProduct(fd)).rejects.toThrow()
        expect(db.product.create).not.toHaveBeenCalled()
    })

    it('throws when requireAdmin rejects (not admin)', async () => {
        vi.mocked(requireAdmin).mockRejectedValue(new Error('Admin access required'))

        await expect(createProduct(validProductFormData())).rejects.toThrow('Admin access required')
        expect(db.product.create).not.toHaveBeenCalled()
    })
})

describe('updateProduct', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireAdmin).mockResolvedValue(mockAdmin as any)
        vi.mocked(db.product.update).mockResolvedValue({ id: 'prod-1' } as any)
    })

    // 3. updateProduct — updates existing product
    it('calls requireAdmin, updates product by id, then redirects', async () => {
        const fd = validProductFormData({ title: 'Widget Pro Updated', stock: '20' })

        let redirectUrl: string | undefined
        try {
            await updateProduct('prod-1', fd)
        } catch (e) {
            if (e instanceof RedirectError) redirectUrl = e.url
            else throw e
        }

        expect(requireAdmin).toHaveBeenCalledOnce()
        expect(db.product.update).toHaveBeenCalledWith({
            where: { id: 'prod-1' },
            data: expect.objectContaining({
                title: 'Widget Pro Updated',
                stock: 20,
            }),
        })
        expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
        expect(redirectUrl).toBe('/admin/products')
    })

    it('throws ZodError when price is negative', async () => {
        const fd = validProductFormData({ price: '-5' })

        await expect(updateProduct('prod-1', fd)).rejects.toThrow()
        expect(db.product.update).not.toHaveBeenCalled()
    })

    it('throws when requireAdmin rejects for updateProduct', async () => {
        vi.mocked(requireAdmin).mockRejectedValue(new Error('Admin access required'))

        await expect(updateProduct('prod-1', validProductFormData())).rejects.toThrow('Admin access required')
        expect(db.product.update).not.toHaveBeenCalled()
    })
})

describe('deleteProduct', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireAdmin).mockResolvedValue(mockAdmin as any)
        vi.mocked(db.orderItem.count).mockResolvedValue(0)
        vi.mocked(db.product.delete).mockResolvedValue({ id: 'prod-1' } as any)
    })

    // 4. deleteProduct — deletes product without orders
    it('calls requireAdmin, deletes product when no orders exist, revalidates path', async () => {
        vi.mocked(db.orderItem.count).mockResolvedValue(0)

        await deleteProduct('prod-1')

        expect(requireAdmin).toHaveBeenCalledOnce()
        expect(db.orderItem.count).toHaveBeenCalledWith({ where: { productId: 'prod-1' } })
        expect(db.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } })
        expect(revalidatePath).toHaveBeenCalledWith('/admin/products')
    })

    // 5. deleteProduct — throws when product has existing orders
    it('throws "Cannot delete product with existing orders" when orders exist', async () => {
        vi.mocked(db.orderItem.count).mockResolvedValue(3)

        await expect(deleteProduct('prod-1')).rejects.toThrow('Cannot delete product with existing orders')
        expect(db.product.delete).not.toHaveBeenCalled()
    })

    it('throws when requireAdmin rejects for deleteProduct', async () => {
        vi.mocked(requireAdmin).mockRejectedValue(new Error('Admin access required'))

        await expect(deleteProduct('prod-1')).rejects.toThrow('Admin access required')
        expect(db.orderItem.count).not.toHaveBeenCalled()
        expect(db.product.delete).not.toHaveBeenCalled()
    })

    it('does not redirect after deleteProduct (no redirect in source)', async () => {
        // deleteProduct only calls revalidatePath, not redirect
        await deleteProduct('prod-1')
        // If we reach here without a RedirectError, the test passes
        expect(db.product.delete).toHaveBeenCalled()
    })
})
