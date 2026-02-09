import Link from 'next/link'

export default function Home() {
  return (
    <div className="shop-app">
      {/* Hero Section */}
      <section className="shop-hero">
        <h1 className="shop-hero-title">
          Welcome to GoldCoins
        </h1>
        <p className="shop-hero-subtitle">
          The future of centralized currency. Secure, fast, and exclusive.
          Purchase goods, book services, and manage your digital wealth.
        </p>

        <div className="shop-hero-actions">
          <Link
            href="/shop"
            className="shop-btn-primary"
          >
            Browse Shop
          </Link>
          <Link
            href="/wallet"
            className="shop-btn-secondary"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="shop-features">
        <div className="shop-features-grid">
          <div className="shop-feature-card">
            <div className="shop-feature-icon">
              💰
            </div>
            <h3 className="shop-feature-title">Secure Wallet</h3>
            <p className="shop-feature-description">Top up with Stripe. Your balance is safe in our centralized ledger.</p>
          </div>
          <div className="shop-feature-card">
            <div className="shop-feature-icon">
              🛒
            </div>
            <h3 className="shop-feature-title">Exclusive Shop</h3>
            <p className="shop-feature-description">Buy unique items and book expert services available only with GoldCoins.</p>
          </div>
          <div className="shop-feature-card">
            <div className="shop-feature-icon">
              📅
            </div>
            <h3 className="shop-feature-title">Easy Booking</h3>
            <p className="shop-feature-description">Schedule services directly through our integrated booking system.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
