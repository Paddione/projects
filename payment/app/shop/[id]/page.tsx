import { db } from '@/lib/db'
import ProductPurchaseForm from '@/components/product-purchase-form'
import { notFound } from 'next/navigation'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })

    if (!product) notFound()

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col md:flex-row">
                <div className="md:w-1/2">
                    {product.imageUrl ? (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                        </>
                    ) : (
                        <div className="w-full h-96 bg-gray-200 flex items-center justify-center text-gray-500">No Image</div>
                    )}
                </div>
                <div className="md:w-1/2 p-8">
                    <h1 className="text-3xl font-bold mb-4">{product.title}</h1>
                    <div className="flex items-center mb-4">
                        <span className="bg-green-100 text-green-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">
                            {product.isService ? 'Service' : 'Product'}
                        </span>
                        <span className="text-gray-500 text-sm">Stock: {product.stock}</span>
                    </div>
                    <p className="text-gray-700 mb-6 text-lg leading-relaxed">{product.description}</p>

                    <div className="border-t pt-6">
                        <ProductPurchaseForm product={product} />
                    </div>
                </div>
            </div>
        </div>
    )
}
