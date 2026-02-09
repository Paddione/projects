import Link from 'next/link'

export default function Home() {
  return (
    <div className="payment-app">
      {/* Hero Section */}
      <section className="payment-hero">
        <h1 className="payment-hero-title">
          Welcome to PatrickCoin
        </h1>
        <p className="payment-hero-subtitle">
          The future of centralized currency. Secure, fast, and exclusive.
          Purchase goods, book services, and manage your digital wealth.
        </p>

        <div className="payment-hero-actions">
          <Link
            href="/shop"
            className="payment-btn-primary"
          >
            Browse Shop
          </Link>
          <Link
            href="/wallet"
            className="payment-btn-secondary"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="payment-features">
        <div className="payment-features-grid">
          <div className="payment-feature-card">
            <div className="payment-feature-icon">
              💰
            </div>
            <h3 className="payment-feature-title">Secure Wallet</h3>
            <p className="payment-feature-description">Top up with Stripe. Your balance is safe in our centralized ledger.</p>
          </div>
          <div className="payment-feature-card">
            <div className="payment-feature-icon">
              🛒
            </div>
            <h3 className="payment-feature-title">Exclusive Shop</h3>
            <p className="payment-feature-description">Buy unique items and book expert services available only with PatrickCoin.</p>
          </div>
          <div className="payment-feature-card">
            <div className="payment-feature-icon">
              📅
            </div>
            <h3 className="payment-feature-title">Easy Booking</h3>
            <p className="payment-feature-description">Schedule services directly through our integrated booking system.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
