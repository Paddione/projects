'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Lang = 'en' | 'de'

const content: Record<Lang, {
  title: string
  sections: { heading: string; items: string[] }[]
}> = {
  en: {
    title: 'Help Guide',
    sections: [
      {
        heading: 'Getting Started',
        items: [
          'Log in with your account to access the shop, wallet, and orders.',
          'New users can sign up through the login page.',
          'Browse the shop to discover available products.',
        ],
      },
      {
        heading: 'Shop',
        items: [
          'Browse products on the Shop page.',
          'Click a product to view its details, pricing, and description.',
          'Add items to your purchase and proceed to checkout.',
          'Payments are processed securely via Stripe.',
        ],
      },
      {
        heading: 'Wallet & PatrickCoin',
        items: [
          'Your wallet shows your current PatrickCoin balance.',
          'Add funds to your wallet via the Add Funds form (processed through Stripe).',
          'View your transaction history to track deposits and purchases.',
          'PatrickCoin is the digital currency used for all transactions.',
        ],
      },
      {
        heading: 'Orders',
        items: [
          'View all past orders on the Orders page.',
          'Each order shows status, items, total amount, and date.',
          'Order details include receipts and tracking information.',
        ],
      },
      {
        heading: 'Appointments',
        items: [
          'Schedule appointments from the Appointments page.',
          'View upcoming and past appointments.',
          'Cancel an appointment if needed.',
        ],
      },
      {
        heading: 'Admin Panel',
        items: [
          'Admin users can access the Admin panel from the navigation.',
          'Manage products: create, edit, and delete products.',
          'Manage users: view, edit roles, and deactivate accounts.',
          'Manage bookings: view and modify all appointments.',
        ],
      },
      {
        heading: 'Security & Payments',
        items: [
          'All payments are processed through Stripe for maximum security.',
          'Your payment details are never stored on our servers.',
          'Sessions are secured and expire automatically.',
        ],
      },
    ],
  },
  de: {
    title: 'Hilfe',
    sections: [
      {
        heading: 'Erste Schritte',
        items: [
          'Melde dich mit deinem Konto an um auf Shop, Wallet und Bestellungen zuzugreifen.',
          'Neue Benutzer koennen sich ueber die Login-Seite registrieren.',
          'Durchsuche den Shop um verfuegbare Produkte zu entdecken.',
        ],
      },
      {
        heading: 'Shop',
        items: [
          'Durchsuche Produkte auf der Shop-Seite.',
          'Klicke auf ein Produkt um Details, Preise und Beschreibung zu sehen.',
          'Fuege Artikel zu deinem Einkauf hinzu und gehe zur Kasse.',
          'Zahlungen werden sicher ueber Stripe abgewickelt.',
        ],
      },
      {
        heading: 'Wallet & PatrickCoin',
        items: [
          'Dein Wallet zeigt deinen aktuellen PatrickCoin-Kontostand.',
          'Lade Guthaben ueber das Auflade-Formular auf (wird ueber Stripe abgewickelt).',
          'Sieh dir deinen Transaktionsverlauf an um Einzahlungen und Kaeufe nachzuverfolgen.',
          'PatrickCoin ist die digitale Waehrung fuer alle Transaktionen.',
        ],
      },
      {
        heading: 'Bestellungen',
        items: [
          'Sieh dir alle vergangenen Bestellungen auf der Bestellseite an.',
          'Jede Bestellung zeigt Status, Artikel, Gesamtbetrag und Datum.',
          'Bestelldetails enthalten Quittungen und Tracking-Informationen.',
        ],
      },
      {
        heading: 'Termine',
        items: [
          'Plane Termine ueber die Termine-Seite.',
          'Sieh dir bevorstehende und vergangene Termine an.',
          'Storniere einen Termin bei Bedarf.',
        ],
      },
      {
        heading: 'Admin-Bereich',
        items: [
          'Admin-Benutzer koennen ueber die Navigation auf den Admin-Bereich zugreifen.',
          'Produkte verwalten: erstellen, bearbeiten und loeschen.',
          'Benutzer verwalten: ansehen, Rollen aendern und Konten deaktivieren.',
          'Buchungen verwalten: alle Termine einsehen und aendern.',
        ],
      },
      {
        heading: 'Sicherheit & Zahlungen',
        items: [
          'Alle Zahlungen werden ueber Stripe fuer maximale Sicherheit abgewickelt.',
          'Deine Zahlungsdaten werden nie auf unseren Servern gespeichert.',
          'Sitzungen sind gesichert und laufen automatisch ab.',
        ],
      },
    ],
  },
}

export default function HelpScreen() {
  const [isOpen, setIsOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [activeSection, setActiveSection] = useState(0)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setIsOpen(false)
  }, [])

  const c = content[lang]

  return (
    <>
      <button
        className="payment-help-button"
        onClick={() => setIsOpen(true)}
        aria-label="Help"
        title="Help"
      >
        ?
      </button>

      {isOpen && (
        <div className="payment-help-overlay" onClick={handleOverlayClick}>
          <div className="payment-help-modal" ref={modalRef} role="dialog" aria-modal="true">
            <div className="payment-help-header">
              <h2>{c.title}</h2>
              <div className="payment-help-header-actions">
                <button
                  className={`payment-help-lang-btn ${lang === 'en' ? 'active' : ''}`}
                  onClick={() => setLang('en')}
                >
                  EN
                </button>
                <button
                  className={`payment-help-lang-btn ${lang === 'de' ? 'active' : ''}`}
                  onClick={() => setLang('de')}
                >
                  DE
                </button>
                <button className="payment-help-close" onClick={() => setIsOpen(false)} aria-label="Close">
                  &times;
                </button>
              </div>
            </div>

            <div className="payment-help-body">
              <nav className="payment-help-sidebar">
                {c.sections.map((s, i) => (
                  <button
                    key={i}
                    className={`payment-help-nav-item ${activeSection === i ? 'active' : ''}`}
                    onClick={() => setActiveSection(i)}
                  >
                    {s.heading}
                  </button>
                ))}
              </nav>

              <div className="payment-help-content">
                <h3>{c.sections[activeSection].heading}</h3>
                <ul>
                  {c.sections[activeSection].items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
