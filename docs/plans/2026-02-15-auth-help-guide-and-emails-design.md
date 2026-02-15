# Auth Help Guide, Email Redesign & Verification Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a contextual help guide modal, fix broken email verification flow, and redesign all email templates with Cybervault branding in German.

**Architecture:** A new `HelpGuide` React component renders on every page via `App.tsx`, using `useLocation()` to show page-specific German help text. Email verification gets its own view in `Login.tsx` with auto-verification on mount. Email templates use a shared `getEmailTemplate()` wrapper for consistent Cybervault branding with inline SVGs.

**Tech Stack:** React 18, React Router v6, Nodemailer, Cybervault CSS design system, inline HTML email templates

---

### Task 1: Add `verifyEmail` and `resendVerification` methods to `authApi.ts`

**Files:**
- Modify: `auth/frontend/src/services/authApi.ts`

**Step 1: Add the methods to the AuthApi class**

Add these two methods to the `AuthApi` class in `auth/frontend/src/services/authApi.ts`, after the `resetPassword` method (after line 194):

```typescript
  static async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...XHR_HEADER,
      },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Email verification failed');
    }

    return response.json();
  }

  static async resendVerification(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...XHR_HEADER,
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to resend verification email');
    }

    return response.json();
  }
```

**Step 2: Commit**

```bash
git add auth/frontend/src/services/authApi.ts
git commit -m "feat(auth): add verifyEmail and resendVerification API methods"
```

---

### Task 2: Fix email verification flow in `Login.tsx`

**Files:**
- Modify: `auth/frontend/src/pages/Login.tsx`

**Step 1: Add 'verify' to the LoginView type and add verify-related state**

Change line 5 from:
```typescript
type LoginView = 'login' | 'forgot' | 'reset';
```
to:
```typescript
type LoginView = 'login' | 'forgot' | 'reset' | 'verify';
```

Add new state variables after line 23 (`const [resetSuccess, setResetSuccess] = useState(false);`):
```typescript
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifyError, setVerifyError] = useState('');
```

**Step 2: Add pathname detection and verify-email auto-call**

The current code on line 33 reads any `token` param as a reset token. We need to differentiate by pathname.

Replace the `useEffect` block for `resetTokenParam` (lines 51-58):
```typescript
  useEffect(() => {
    if (!resetTokenParam) {
      return;
    }

    setResetToken(resetTokenParam);
    setView('reset');
  }, [resetTokenParam]);
```

with:
```typescript
  useEffect(() => {
    if (!resetTokenParam) {
      return;
    }

    // Differentiate: /verify-email uses the token for verification, not password reset
    if (window.location.pathname === '/verify-email') {
      setView('verify');
      setVerifyLoading(true);
      AuthApi.verifyEmail(resetTokenParam)
        .then((res) => {
          setVerifyMessage(res.message || 'E-Mail erfolgreich bestätigt!');
        })
        .catch((err) => {
          setVerifyError(err instanceof Error ? err.message : 'Verifizierung fehlgeschlagen');
        })
        .finally(() => {
          setVerifyLoading(false);
        });
    } else {
      setResetToken(resetTokenParam);
      setView('reset');
    }
  }, [resetTokenParam]);
```

**Step 3: Add the verify view JSX**

After the `{view === 'reset' && (` block (after line 408 `)}` closing), add:

```tsx
        {view === 'verify' && (
          <div className="auth-form">
            {verifyLoading && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div className="hub-spinner" style={{ margin: '0 auto var(--cv-space-4)' }}></div>
                <p style={{ color: 'var(--cv-text-secondary)' }}>E-Mail wird bestätigt...</p>
              </div>
            )}

            {!verifyLoading && verifyMessage && (
              <>
                <div className="auth-message auth-message-success">
                  {verifyMessage}
                </div>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="auth-btn-primary"
                >
                  Weiter zur Anmeldung
                </button>
              </>
            )}

            {!verifyLoading && verifyError && (
              <>
                <div className="auth-message auth-message-error">
                  {verifyError}
                </div>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="auth-btn-secondary"
                >
                  Zurück zur Anmeldung
                </button>
              </>
            )}
          </div>
        )}
```

**Step 4: Update the header title/subtitle for the verify view**

Update the title (line 169) to include verify:
```tsx
            {view === 'login' ? 'Welcome Back' : (view === 'forgot' ? 'Reset your password' : (view === 'verify' ? 'E-Mail-Bestätigung' : 'Choose a new password'))}
```

Update the subtitle (line 172-174) to include verify:
```tsx
            {view === 'login'
              ? 'Sign in to your account'
              : (view === 'forgot' ? 'Enter your email to receive a reset link' : (view === 'verify' ? 'Deine E-Mail-Adresse wird überprüft' : 'Enter a new password for your account'))}
```

Update the title className (line 168) to include verify:
```tsx
          <h1 className={`auth-title ${view === 'login' ? 'auth-view-login' : (view === 'forgot' ? 'auth-view-forgot' : (view === 'verify' ? 'auth-view-verify' : 'auth-view-reset'))}`}>
```

**Step 5: Add CSS for the verify view title style**

Add to `cybervault-auth.css` after the `.auth-view-forgot` / `.auth-view-reset` title styles (after line 496):
```css
.auth-view-verify .auth-title {
  color: var(--auth-verified);
  text-shadow: 0 0 20px var(--auth-verified-glow);
}
```

**Step 6: Commit**

```bash
git add auth/frontend/src/pages/Login.tsx auth/frontend/src/styles/cybervault-auth.css
git commit -m "fix(auth): add proper email verification view instead of reusing reset view"
```

---

### Task 3: Create the HelpGuide component

**Files:**
- Create: `auth/frontend/src/components/HelpGuide.tsx`

**Step 1: Create the component file**

Create `auth/frontend/src/components/HelpGuide.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface HelpSection {
  title: string;
  description: string;
}

interface PageHelp {
  pageTitle: string;
  sections: HelpSection[];
}

const helpContent: Record<string, PageHelp> = {
  '/login': {
    pageTitle: 'Anmeldung',
    sections: [
      {
        title: 'Anmelden',
        description: 'Gib deinen Benutzernamen oder deine E-Mail-Adresse zusammen mit deinem Passwort ein und klicke auf "Sign In".',
      },
      {
        title: 'Google-Anmeldung',
        description: 'Alternativ kannst du dich mit deinem Google-Konto anmelden. Klicke dazu auf "Sign in with Google".',
      },
      {
        title: 'Passwort vergessen?',
        description: 'Klicke auf "Forgot password?" neben dem Passwort-Feld. Du erhältst eine E-Mail mit einem Link, um ein neues Passwort zu setzen.',
      },
      {
        title: 'Konto erstellen',
        description: 'Noch kein Konto? Klicke unten auf "Sign up", um dich zu registrieren.',
      },
    ],
  },
  '/register': {
    pageTitle: 'Registrierung',
    sections: [
      {
        title: 'Konto erstellen',
        description: 'Fülle Benutzername, E-Mail und Passwort aus. Der vollständige Name ist optional.',
      },
      {
        title: 'Passwort-Regeln',
        description: 'Dein Passwort muss mindestens 8 Zeichen lang sein und Großbuchstaben, Kleinbuchstaben, eine Zahl und ein Sonderzeichen (@$!%*?&) enthalten.',
      },
      {
        title: 'Google-Registrierung',
        description: 'Du kannst dich auch direkt mit deinem Google-Konto registrieren — klicke auf "Sign up with Google".',
      },
      {
        title: 'E-Mail-Bestätigung',
        description: 'Nach der Registrierung erhältst du eine E-Mail mit einem Bestätigungslink. Klicke darauf, um dein Konto zu aktivieren.',
      },
    ],
  },
  '/hub': {
    pageTitle: 'Access Hub',
    sections: [
      {
        title: 'Apps öffnen',
        description: 'Klicke bei einer freigeschalteten App auf "Open", um sie zu starten. Freigeschaltete Apps haben einen cyan-farbenen Rahmen.',
      },
      {
        title: 'Zugang anfragen',
        description: 'Bei gesperrten Apps klicke auf "Request Access" und gib optional einen Grund an. Ein Admin wird deine Anfrage prüfen.',
      },
      {
        title: 'Anfragen einsehen',
        description: 'Klicke auf "Your Requests", um den Status deiner Zugangsanfragen zu sehen (ausstehend, genehmigt, abgelehnt).',
      },
      {
        title: 'Admin-Panel',
        description: 'Nur für Admins sichtbar: Der Button "Admin Panel" oben rechts führt zur Benutzerverwaltung.',
      },
      {
        title: 'Abmelden',
        description: 'Klicke auf "Sign Out" oben rechts, um dich sicher abzumelden.',
      },
    ],
  },
  '/admin': {
    pageTitle: 'Admin-Panel',
    sections: [
      {
        title: 'Zugangsanfragen',
        description: 'Im Tab "Access Requests" siehst du offene Anfragen von Benutzern. Klicke auf "Review", um eine Anfrage zu genehmigen oder abzulehnen.',
      },
      {
        title: 'Benutzer verwalten',
        description: 'Im Tab "Users" findest du alle registrierten Benutzer. Nutze die Suche und klicke auf "Edit", um Benutzerdetails zu bearbeiten.',
      },
      {
        title: 'Zugangsliste',
        description: 'Im Tab "Access List" siehst du pro App, welche Benutzer Zugang haben. Wähle links eine App aus.',
      },
      {
        title: 'Benutzer bearbeiten',
        description: 'Im Editor kannst du Rolle, Kontostatus, L2P-Charakter-Einstellungen und App-Zugangsrechte ändern.',
      },
    ],
  },
};

// Fallback for routes without specific help
const defaultHelp: PageHelp = {
  pageTitle: 'Hilfe',
  sections: [
    {
      title: 'Willkommen',
      description: 'Dies ist das Korczewski Auth Portal. Hier kannst du dich anmelden, registrieren und deine App-Zugänge verwalten.',
    },
    {
      title: 'Navigation',
      description: 'Nutze die Links auf der Seite, um zwischen Anmeldung, Registrierung und dem Access Hub zu wechseln.',
    },
  ],
};

export default function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Resolve help content: try exact path, then strip trailing segments
  const getHelp = (): PageHelp => {
    const path = location.pathname;
    if (helpContent[path]) return helpContent[path];
    // For /reset-password and /verify-email, show login help
    if (path === '/reset-password' || path === '/verify-email') return helpContent['/login'];
    return defaultHelp;
  };

  const help = getHelp();

  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  // Close modal on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <>
      <button
        className="help-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Hilfe öffnen"
        title="Hilfe"
      >
        ?
      </button>

      {isOpen && (
        <div className="help-modal-overlay" onClick={handleClose}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <div className="help-modal-title-row">
                <svg viewBox="0 0 24 24" className="help-modal-icon">
                  <circle cx="12" cy="12" r="10" stroke="url(#helpGrad)" strokeWidth="1.5" fill="none" />
                  <text x="12" y="17" textAnchor="middle" fill="url(#helpGrad)" fontSize="14" fontWeight="bold">?</text>
                  <defs>
                    <linearGradient id="helpGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00f2ff"/>
                      <stop offset="100%" stopColor="#bc13fe"/>
                    </linearGradient>
                  </defs>
                </svg>
                <h2>{help.pageTitle}</h2>
              </div>
              <button className="help-modal-close" onClick={handleClose} aria-label="Schließen">
                &times;
              </button>
            </div>

            <div className="help-modal-body">
              {help.sections.map((section, index) => (
                <div key={index} className="help-section">
                  <div className="help-section-header">
                    <span className="help-step-number">{index + 1}</span>
                    <h3>{section.title}</h3>
                  </div>
                  <p>{section.description}</p>
                </div>
              ))}
            </div>

            <div className="help-modal-footer">
              <span>Korczewski Auth</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add auth/frontend/src/components/HelpGuide.tsx
git commit -m "feat(auth): add HelpGuide component with page-contextual German help content"
```

---

### Task 4: Add HelpGuide to App.tsx and add CSS styles

**Files:**
- Modify: `auth/frontend/src/App.tsx`
- Modify: `auth/frontend/src/styles/cybervault-auth.css`

**Step 1: Add HelpGuide to App.tsx**

Replace the entire `App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Hub from './pages/Hub';
import Admin from './pages/Admin';
import HelpGuide from './components/HelpGuide';

function App() {
  return (
    <BrowserRouter>
      <HelpGuide />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<Login />} />
        <Route path="/verify-email" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/hub" element={<Hub />} />
        <Route path="/apps" element={<Navigate to="/hub" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Step 2: Add the help guide CSS to cybervault-auth.css**

Append to the end of `auth/frontend/src/styles/cybervault-auth.css` (before the final closing or at the end of the file):

```css
/* ============================================================================
   HELP GUIDE - Floating Action Button & Modal
   ========================================================================= */

.help-fab {
  position: fixed;
  bottom: var(--cv-space-6);
  right: var(--cv-space-6);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--cv-gradient-primary);
  color: var(--cv-void);
  border: none;
  font-size: 22px;
  font-weight: 900;
  cursor: pointer;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--cv-glow-purple-md);
  transition: all var(--cv-duration-fast) var(--cv-ease-smooth);
  animation: help-fab-pulse 3s ease-in-out infinite;
}

.help-fab:hover {
  transform: scale(1.1);
  box-shadow: var(--cv-glow-purple-lg);
}

@keyframes help-fab-pulse {
  0%, 100% { box-shadow: 0 0 15px var(--cv-purple-glow); }
  50% { box-shadow: 0 0 25px var(--cv-purple-glow), 0 0 40px var(--cv-cyan-glow); }
}

.help-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: var(--cv-space-4);
  animation: cv-fade-in var(--cv-duration-fast) var(--cv-ease-smooth);
}

.help-modal {
  background: var(--cv-glass-strong);
  border: var(--cv-border-width) solid var(--cv-border-2);
  border-radius: var(--cv-radius-lg);
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: cv-fade-in-up var(--cv-duration-base) var(--cv-ease-bounce);
  box-shadow: var(--cv-shadow-2xl), 0 0 40px var(--cv-purple-glow);
}

.help-modal::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 20%;
  right: 20%;
  height: 2px;
  background: var(--cv-gradient-primary);
  filter: blur(4px);
  border-radius: var(--cv-radius-lg) var(--cv-radius-lg) 0 0;
}

.help-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--cv-space-5) var(--cv-space-6);
  border-bottom: var(--cv-border-width) solid var(--cv-border-2);
}

.help-modal-title-row {
  display: flex;
  align-items: center;
  gap: var(--cv-space-3);
}

.help-modal-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.help-modal-header h2 {
  font-family: var(--cv-font-display);
  font-size: var(--cv-text-xl);
  color: var(--cv-text-primary);
  margin: 0;
}

.help-modal-close {
  width: 32px;
  height: 32px;
  background: transparent;
  border: var(--cv-border-width) solid var(--cv-border-2);
  border-radius: var(--cv-radius-md);
  color: var(--cv-text-tertiary);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--cv-duration-fast) var(--cv-ease-smooth);
}

.help-modal-close:hover {
  border-color: var(--cv-danger);
  color: var(--cv-danger);
}

.help-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--cv-space-5) var(--cv-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--cv-space-4);
}

.help-section {
  background: var(--cv-glass-1);
  border: var(--cv-border-width) solid var(--cv-border-2);
  border-radius: var(--cv-radius-md);
  padding: var(--cv-space-4);
  transition: border-color var(--cv-duration-fast) var(--cv-ease-smooth);
}

.help-section:hover {
  border-color: var(--cv-cyan-border);
}

.help-section-header {
  display: flex;
  align-items: center;
  gap: var(--cv-space-3);
  margin-bottom: var(--cv-space-2);
}

.help-step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 50%;
  background: var(--cv-gradient-primary);
  color: var(--cv-void);
  font-size: 12px;
  font-weight: 700;
}

.help-section-header h3 {
  font-size: var(--cv-text-base);
  font-weight: 700;
  color: var(--cv-cyan);
  margin: 0;
}

.help-section p {
  font-size: var(--cv-text-sm);
  color: var(--cv-text-secondary);
  line-height: 1.6;
  margin: 0;
}

.help-modal-footer {
  padding: var(--cv-space-3) var(--cv-space-6);
  border-top: var(--cv-border-width) solid var(--cv-border-2);
  text-align: center;
}

.help-modal-footer span {
  font-size: var(--cv-text-xs);
  color: var(--cv-text-tertiary);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

@media (max-width: 640px) {
  .help-fab {
    bottom: var(--cv-space-4);
    right: var(--cv-space-4);
    width: 44px;
    height: 44px;
    font-size: 20px;
  }

  .help-modal {
    max-height: 90vh;
  }

  .help-modal-header,
  .help-modal-body {
    padding-left: var(--cv-space-4);
    padding-right: var(--cv-space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .help-fab {
    animation: none;
  }
}
```

**Step 3: Commit**

```bash
git add auth/frontend/src/App.tsx auth/frontend/src/styles/cybervault-auth.css
git commit -m "feat(auth): wire up HelpGuide in App.tsx and add help guide CSS styles"
```

---

### Task 5: Redesign email templates in EmailService.ts

**Files:**
- Modify: `auth/src/services/EmailService.ts`

**Step 1: Replace the entire EmailService.ts with branded templates**

Replace the full file `auth/src/services/EmailService.ts`:

```typescript
import nodemailer from 'nodemailer';

export class EmailService {
    private transporter: nodemailer.Transporter;
    private fromEmail: string;
    private appUrl: string;

    constructor() {
        this.fromEmail = process.env.SMTP_FROM || 'noreply@korczewski.de';
        this.appUrl = process.env.APP_URL || 'http://localhost:3000';

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Shared Cybervault email template wrapper
     */
    private getEmailTemplate(content: string): string {
        return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Korczewski Auth</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: rgba(10, 10, 46, 0.95); border: 1px solid rgba(0, 242, 255, 0.15); border-radius: 12px; overflow: hidden;">
          <!-- Gradient accent line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #00f2ff, #bc13fe);"></td>
          </tr>
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 16px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="64" height="64">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#00f2ff"/>
                    <stop offset="100%" stop-color="#bc13fe"/>
                  </linearGradient>
                </defs>
                <path d="M40 6L68 18v22c0 14-11 26-28 30C23 66 12 54 12 40V18L40 6z" stroke="url(#g)" stroke-width="2" fill="none"/>
                <circle cx="40" cy="32" r="7" stroke="url(#g)" stroke-width="1.5" fill="none"/>
                <rect x="38.5" y="39" width="3" height="14" fill="url(#g)"/>
                <rect x="41.5" y="46" width="6" height="3" fill="url(#g)"/>
              </svg>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid rgba(0, 242, 255, 0.1); padding: 16px 32px; text-align: center;">
              <span style="font-size: 11px; color: rgba(255,255,255,0.3); letter-spacing: 0.1em; text-transform: uppercase;">Korczewski Auth</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    /**
     * Styled CTA button for emails
     */
    private getButton(text: string, url: string): string {
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
        <tr>
          <td style="background: linear-gradient(135deg, #bc13fe, #00f2ff); border-radius: 8px; padding: 2px;">
            <a href="${url}" target="_blank" style="display: block; background-color: #1a1a4e; border-radius: 6px; padding: 14px 32px; color: #00f2ff; font-weight: 700; font-size: 15px; text-decoration: none; text-align: center; letter-spacing: 0.03em;">${text}</a>
          </td>
        </tr>
      </table>`;
    }

    /**
     * Send verification email
     */
    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const verificationUrl = `${this.appUrl}/verify-email?token=${token}`;

        const content = `
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px; text-align: center;">E-Mail-Bestätigung</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hallo!</p>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Bitte bestätige deine E-Mail-Adresse, indem du auf den Button klickst:</p>
              ${this.getButton('E-Mail bestätigen', verificationUrl)}
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; line-height: 1.5; margin: 16px 0 0; text-align: center;">Dieser Link ist 24 Stunden gültig.</p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.5; margin: 8px 0 0; text-align: center;">Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>`;

        const mailOptions = {
            from: `"Korczewski Auth" <${this.fromEmail}>`,
            to,
            subject: 'Bestätige deine E-Mail-Adresse',
            html: this.getEmailTemplate(content),
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

        const content = `
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px; text-align: center;">Passwort zurücksetzen</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hallo!</p>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Du hast eine Passwort-Zurücksetzung angefordert. Klicke auf den Button, um ein neues Passwort zu wählen:</p>
              ${this.getButton('Passwort zurücksetzen', resetUrl)}
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; line-height: 1.5; margin: 16px 0 0; text-align: center;">Dieser Link ist 1 Stunde gültig.</p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.5; margin: 8px 0 0; text-align: center;">Falls du dies nicht angefordert hast, ignoriere diese E-Mail.</p>`;

        const mailOptions = {
            from: `"Korczewski Auth" <${this.fromEmail}>`,
            to,
            subject: 'Setze dein Passwort zurück',
            html: this.getEmailTemplate(content),
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * Send security alert email
     */
    async sendSecurityAlert(to: string, action: string, metadata: any = {}): Promise<void> {
        const time = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'medium' });

        const detailRows = [
            `<tr><td style="color: rgba(255,255,255,0.5); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">Zeitpunkt</td><td style="color: rgba(255,255,255,0.8); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">${time}</td></tr>`,
            metadata.ip ? `<tr><td style="color: rgba(255,255,255,0.5); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">IP-Adresse</td><td style="color: rgba(255,255,255,0.8); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">${metadata.ip}</td></tr>` : '',
            metadata.userAgent ? `<tr><td style="color: rgba(255,255,255,0.5); font-size: 13px; padding: 6px 12px;">Browser</td><td style="color: rgba(255,255,255,0.8); font-size: 13px; padding: 6px 12px;">${metadata.userAgent}</td></tr>` : '',
        ].filter(Boolean).join('');

        const content = `
              <h1 style="color: #ffaa00; font-size: 22px; font-weight: 700; margin: 0 0 16px; text-align: center;">Sicherheitshinweis</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Auf deinem Konto wurde eine sicherheitsrelevante Aktion durchgeführt:</p>
              <p style="color: #00f2ff; font-size: 16px; font-weight: 700; margin: 0 0 20px; padding: 12px; background: rgba(0,242,255,0.05); border: 1px solid rgba(0,242,255,0.15); border-radius: 8px; text-align: center;">${action}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(0,242,255,0.03); border: 1px solid rgba(0,242,255,0.1); border-radius: 8px; margin-bottom: 20px;">
                ${detailRows}
              </table>
              <p style="color: #ff3366; font-size: 14px; font-weight: 600; line-height: 1.5; margin: 0; text-align: center;">Falls du das nicht warst, ändere sofort dein Passwort.</p>`;

        const mailOptions = {
            from: `"Korczewski Auth" <${this.fromEmail}>`,
            to,
            subject: `Sicherheitshinweis: ${action}`,
            html: this.getEmailTemplate(content),
        };

        await this.transporter.sendMail(mailOptions);
    }
}
```

**Step 2: Commit**

```bash
git add auth/src/services/EmailService.ts
git commit -m "feat(auth): redesign email templates with Cybervault branding and German copy"
```

---

### Task 6: Manual verification

**Step 1: Build and verify no TypeScript errors**

```bash
cd /home/patrick/projects/auth/frontend && npx tsc --noEmit
```

Expected: No errors.

**Step 2: Visually verify the help guide**

Start dev server:
```bash
cd /home/patrick/projects/auth && npm run dev
```

Then visit:
- `http://localhost:5501/login` — click ? button, verify German help for login page
- `http://localhost:5501/register` — click ? button, verify German help for registration
- `http://localhost:5501/hub` — click ? button, verify German help for hub
- `http://localhost:5501/admin` — click ? button, verify German help for admin
- Verify ? button is in bottom-right, modal is centered, Escape closes it

**Step 3: Verify email verification flow**

Visit `http://localhost:5501/verify-email?token=test123` and verify:
- Title shows "E-Mail-Bestätigung" (green color)
- Spinner appears briefly, then error message (invalid token is expected)
- "Zurück zur Anmeldung" button works

**Step 4: Commit any fixes if needed**

---

### Task 7: Deploy to production

**Step 1: Deploy auth service**

```bash
cd /home/patrick/projects/k8s && skaffold run -p auth
```

Expected: Successful build and deploy.

**Step 2: Verify on production**

Visit `https://auth.korczewski.de` and verify:
- ? button visible on login page
- Help modal shows correct German content
- Navigate to register, hub, admin — help updates per page
