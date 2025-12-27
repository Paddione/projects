import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white py-20 px-8 text-center flex-1 flex flex-col justify-center items-center">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-6 animate-fade-in-up">
          Welcome to PatrickCoin
        </h1>
        <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto text-purple-100">
          The future of centralized currency. Secure, fast, and exclusive.
          Purchase goods, book services, and manage your digital wealth.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/shop"
            className="bg-white text-purple-900 font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-100 transition shadow-lg"
          >
            Browse Shop
          </Link>
          <Link
            href="/login"
            className="bg-transparent border-2 border-white text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-white hover:text-purple-900 transition"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              💰
            </div>
            <h3 className="text-xl font-bold mb-2">Secure Wallet</h3>
            <p className="text-gray-600">Top up with Stripe. Your balance is safe in our centralized ledger.</p>
          </div>
          <div className="text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              🛒
            </div>
            <h3 className="text-xl font-bold mb-2">Exclusive Shop</h3>
            <p className="text-gray-600">Buy unique items and book expert services available only with PatrickCoin.</p>
          </div>
          <div className="text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              📅
            </div>
            <h3 className="text-xl font-bold mb-2">Easy Booking</h3>
            <p className="text-gray-600">Schedule services directly through our integrated booking system.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
