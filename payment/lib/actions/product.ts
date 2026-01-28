'use server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/actions/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const productSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    price: z.coerce.number().min(0),
    stock: z.coerce.number().min(0),
    imageUrl: z.string().optional(),
    isService: z.boolean().optional(),
})

export async function createProduct(formData: FormData) {
    await requireAdmin() // Throws if not admin

    const rawData = {
        title: formData.get('title'),
        description: formData.get('description'),
        price: formData.get('price'),
        stock: formData.get('stock'),
        imageUrl: formData.get('imageUrl') || undefined,
        isService: formData.get('isService') === 'on',
    }

    const validatedData = productSchema.parse(rawData)

    await db.product.create({
        data: validatedData,
    })

    revalidatePath('/admin/products')
    redirect('/admin/products')
}

export async function deleteProduct(id: string) {
    await requireAdmin() // Throws if not admin

    await db.product.delete({
        where: { id },
    })

    revalidatePath('/admin/products')
}
