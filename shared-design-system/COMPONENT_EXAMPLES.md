# Cybervault Design System - Component Examples

Complete guide to implementing the Cybervault design system across all applications in the monorepo.

## Table of Contents

- [Getting Started](#getting-started)
- [Universal Components](#universal-components)
- [L2P Components](#l2p-components)
- [VideoVault Components](#videovault-components)
- [Payment Components](#payment-components)
- [Auth Components](#auth-components)
- [Theme Customization](#theme-customization)

---

## Getting Started

### Installation

Each application imports the base Cybervault system and its specific theme:

**L2P Frontend** (`l2p/frontend/src/index.css`):
```css
@import '../../../shared-design-system/cybervault.css';
@import './cybervault-l2p.css';
```

**VideoVault** (`VideoVault/client/src/main.tsx`):
```tsx
import './styles/cybervault-videovault.css';
```

**Payment** (`payment/app/layout.tsx`):
```tsx
import './cybervault-payment.css';
```

**Auth** (`auth/frontend/src/main.tsx`):
```tsx
import './styles/cybervault-auth.css';
```

---

## Universal Components

These components use only the base Cybervault system and work across all applications.

### Glass Card

A glassmorphic card with glow effects.

```html
<div class="cv-glass" style="padding: var(--cv-space-6); max-width: 600px;">
  <h3 class="cv-heading-3">Glass Card</h3>
  <p style="color: var(--cv-text-secondary); margin-top: var(--cv-space-2);">
    This card uses glassmorphism with backdrop blur and subtle glow.
  </p>
</div>
```

**Result**: Semi-transparent card with glassmorphic effect and subtle border glow.

---

### Primary Button

Gradient button with glow and hover effects.

```html
<button class="cv-btn-primary">
  Launch Mission
</button>
```

**Styles**:
- Background: Cyan-to-purple gradient
- Hover: Lifts with increased glow
- Active: Presses down
- Disabled: Reduced opacity

---

### Cyan Accent Button

Outlined button with cyan accent.

```html
<button class="cv-btn-accent-cyan">
  Connect System
</button>
```

**Styles**:
- Border: Cyan with glow
- Hover: Background fills with glass, increased glow
- Focus: Visible outline for accessibility

---

### Badge

Status indicator with various colors.

```html
<!-- Cyan badge -->
<span class="cv-badge-cyan">Active</span>

<!-- Purple badge -->
<span class="cv-badge-purple">Premium</span>

<!-- Success badge -->
<span class="cv-badge-success">Verified</span>

<!-- Warning badge -->
<span class="cv-badge-warning">Pending</span>

<!-- Danger badge -->
<span class="cv-badge-danger">Critical</span>
```

---

### Animated Gradient Border

Flowing gradient animation around an element.

```html
<div class="cv-gradient-flow" style="padding: var(--cv-space-8); text-align: center;">
  <p class="cv-heading-2">Neural Network Status</p>
  <p style="color: var(--cv-cyan); margin-top: var(--cv-space-2);">ONLINE</p>
</div>
```

**Effect**: Animated gradient border that flows around the element.

---

### Input Field

Glassmorphic input with focus states.

```html
<div style="max-width: 400px;">
  <label style="
    display: block;
    font-size: var(--cv-text-sm);
    font-weight: 600;
    color: var(--cv-text-secondary);
    margin-bottom: var(--cv-space-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  ">
    Access Code
  </label>
  <input
    type="text"
    placeholder="Enter code..."
    style="
      width: 100%;
      background: var(--cv-glass-1);
      border: var(--cv-border-width) solid var(--cv-border-2);
      border-radius: var(--cv-radius-md);
      padding: var(--cv-space-3) var(--cv-space-4);
      font-size: var(--cv-text-base);
      color: var(--cv-text-primary);
      font-family: var(--cv-font-body);
      transition: all var(--cv-duration-fast) var(--cv-ease-smooth);
    "
    onfocus="this.style.borderColor='var(--cv-cyan-border)'; this.style.boxShadow='var(--cv-glow-cyan-sm)'"
    onblur="this.style.borderColor='var(--cv-border-2)'; this.style.boxShadow='none'"
  />
</div>
```

---

## L2P Components

Gaming arena aesthetic for competitive quiz platform.

### Lobby Code Display

Large, animated lobby code with gradient text.

```html
<div class="lobby-code-container">
  <div class="lobby-code">CYBER-7X9K</div>
  <p style="color: var(--cv-text-tertiary); margin-top: var(--cv-space-2);">
    Share this code with players
  </p>
</div>
```

**CSS** (already in `cybervault-l2p.css`):
```css
.lobby-code {
  font-family: var(--cv-font-display);
  font-size: var(--cv-text-4xl);
  background: var(--cv-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: cv-pulse-glow 2s ease-in-out infinite;
  letter-spacing: 0.1em;
  text-align: center;
}
```

---

### Player Card

Card showing player info with avatar and stats.

```html
<div class="player-card">
  <div class="player-avatar" style="background: var(--cv-gradient-primary);">
    <span style="font-size: var(--cv-text-2xl); font-weight: 700;">JD</span>
  </div>
  <div class="player-info">
    <div class="player-name">John Doe</div>
    <div class="player-score">1,250 pts</div>
  </div>
  <span class="cv-badge-success">Ready</span>
</div>
```

**CSS**:
```css
.player-card {
  display: flex;
  align-items: center;
  gap: var(--cv-space-4);
  background: var(--cv-glass-2);
  border: var(--cv-border-width) solid var(--cv-border-2);
  border-radius: var(--cv-radius-lg);
  padding: var(--cv-space-4);
  transition: all var(--cv-duration-base) var(--cv-ease-smooth);
}

.player-card:hover {
  border-color: var(--cv-cyan-border);
  box-shadow: var(--cv-glow-cyan-sm);
  transform: translateX(4px);
}

.player-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--cv-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cv-void);
  box-shadow: var(--cv-glow-cyan-md);
}

.player-info {
  flex: 1;
}

.player-name {
  font-weight: 700;
  color: var(--cv-text-primary);
  font-size: var(--cv-text-base);
}

.player-score {
  font-size: var(--cv-text-sm);
  color: var(--cv-text-tertiary);
  font-family: var(--cv-font-mono);
}
```

---

### Answer Options

Interactive quiz answer buttons with correct/incorrect states.

```html
<div class="answer-options-grid">
  <button class="answer-option">
    <span class="answer-letter">A</span>
    <span class="answer-text">Tokyo</span>
  </button>
  <button class="answer-option answer-option-selected">
    <span class="answer-letter">B</span>
    <span class="answer-text">Paris</span>
  </button>
  <button class="answer-option answer-option-correct">
    <span class="answer-letter">C</span>
    <span class="answer-text">London</span>
  </button>
  <button class="answer-option answer-option-incorrect">
    <span class="answer-letter">D</span>
    <span class="answer-text">Berlin</span>
  </button>
</div>
```

**CSS** (already in `cybervault-l2p.css`):
```css
.answer-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--cv-space-4);
}

.answer-option {
  display: flex;
  align-items: center;
  gap: var(--cv-space-4);
  background: var(--cv-glass-2);
  border: 2px solid var(--cv-border-2);
  border-radius: var(--cv-radius-lg);
  padding: var(--cv-space-4);
  cursor: pointer;
  transition: all var(--cv-duration-base) var(--cv-ease-smooth);
}

.answer-option:hover:not(.answer-option-correct):not(.answer-option-incorrect) {
  border-color: var(--cv-cyan-border);
  box-shadow: var(--cv-glow-cyan-sm);
  transform: scale(1.02);
}

.answer-option-selected {
  border-color: var(--cv-cyan-border);
  background: rgba(0, 242, 255, 0.05);
  box-shadow: var(--cv-glow-cyan-md);
}

.answer-option-correct {
  border-color: var(--cv-success);
  background: var(--cv-success-subtle);
  box-shadow: var(--cv-glow-success);
  animation: correctAnswer 0.5s var(--cv-ease-bounce);
}

.answer-option-incorrect {
  border-color: var(--cv-danger);
  background: var(--cv-danger-subtle);
  box-shadow: var(--cv-glow-danger);
  animation: cv-shake 0.4s var(--cv-ease-smooth);
}

.answer-letter {
  font-family: var(--cv-font-display);
  font-size: var(--cv-text-xl);
  font-weight: 900;
  color: var(--cv-cyan);
  width: 32px;
  height: 32px;
  background: var(--cv-glass-3);
  border-radius: var(--cv-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.answer-text {
  flex: 1;
  text-align: left;
  font-size: var(--cv-text-base);
  color: var(--cv-text-primary);
  font-weight: 600;
}
```

---

## VideoVault Components

Media command center aesthetic for video management.

### Video Card

Card displaying video thumbnail and metadata.

```html
<div class="video-card">
  <div class="video-thumbnail">
    <img src="/path/to/thumbnail.jpg" alt="Video title" />
    <div class="video-duration">12:34</div>
    <div class="video-overlay">
      <button class="video-play-btn">▶</button>
    </div>
  </div>
  <div class="video-info">
    <h3 class="video-title">Quantum Mechanics Explained</h3>
    <div class="video-meta">
      <span class="cv-badge-cyan">Science</span>
      <span style="color: var(--cv-text-tertiary); font-size: var(--cv-text-xs);">
        Added: 2024-01-10
      </span>
    </div>
  </div>
</div>
```

**CSS** (already in `cybervault-videovault.css`):
```css
.video-card {
  background: var(--cv-glass-2);
  border: var(--cv-border-width) solid var(--cv-border-2);
  border-radius: var(--vv-card-radius);
  overflow: hidden;
  transition: all var(--cv-duration-base) var(--cv-ease-smooth);
  cursor: pointer;
}

.video-card:hover {
  transform: translateY(-6px);
  border-color: var(--cv-cyan-border);
  box-shadow: var(--cv-glow-cyan-md), var(--cv-shadow-lg);
}

.video-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--cv-glass-1);
  overflow: hidden;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--cv-duration-slow) var(--cv-ease-smooth);
}

.video-card:hover .video-thumbnail img {
  transform: scale(1.05);
}

.video-duration {
  position: absolute;
  bottom: var(--cv-space-2);
  right: var(--cv-space-2);
  background: rgba(0, 0, 0, 0.8);
  color: var(--cv-text-primary);
  padding: var(--cv-space-1) var(--cv-space-2);
  border-radius: var(--cv-radius-sm);
  font-size: var(--cv-text-xs);
  font-family: var(--cv-font-mono);
}

.video-overlay {
  position: absolute;
  inset: 0;
  background: rgba(3, 4, 8, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--cv-duration-base) var(--cv-ease-smooth);
}

.video-card:hover .video-overlay {
  opacity: 1;
}

.video-play-btn {
  width: 64px;
  height: 64px;
  background: var(--cv-gradient-primary);
  border: none;
  border-radius: var(--cv-radius-full);
  color: var(--cv-void);
  font-size: var(--cv-text-2xl);
  cursor: pointer;
  box-shadow: var(--cv-glow-cyan-lg);
  transition: all var(--cv-duration-fast) var(--cv-ease-smooth);
}

.video-play-btn:hover {
  transform: scale(1.1);
  box-shadow: var(--cv-glow-cyan-xl);
}

.video-info {
  padding: var(--cv-space-4);
}

.video-title {
  font-size: var(--cv-text-base);
  font-weight: 700;
  color: var(--cv-text-primary);
  margin-bottom: var(--cv-space-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-meta {
  display: flex;
  align-items: center;
  gap: var(--cv-space-3);
  flex-wrap: wrap;
}
```

---

### Bulk Actions Bar

Fixed bottom bar for bulk operations.

```html
<div class="bulk-actions-bar">
  <div class="bulk-selected-count">
    <span style="font-family: var(--cv-font-display); font-weight: 700; color: var(--cv-cyan);">
      12
    </span>
    <span style="color: var(--cv-text-secondary);">videos selected</span>
  </div>
  <div class="bulk-actions">
    <button class="cv-btn-accent-cyan">Add Tags</button>
    <button class="cv-btn-accent-purple">Move to Collection</button>
    <button style="
      background: transparent;
      color: var(--cv-danger);
      border: var(--cv-border-width) solid var(--cv-danger);
      padding: var(--cv-space-2) var(--cv-space-4);
      border-radius: var(--cv-radius-md);
      font-size: var(--cv-text-sm);
      font-weight: 600;
      cursor: pointer;
    ">
      Delete
    </button>
  </div>
</div>
```

**CSS** (already in `cybervault-videovault.css`):
```css
.bulk-actions-bar {
  position: fixed;
  bottom: var(--cv-space-8);
  left: 50%;
  transform: translateX(-50%);
  background: var(--cv-glass-strong);
  border: var(--cv-border-width) solid var(--cv-cyan-border);
  border-radius: var(--cv-radius-lg);
  padding: var(--cv-space-4) var(--cv-space-6);
  box-shadow: var(--cv-glow-cyan-lg), var(--cv-shadow-xl);
  backdrop-filter: var(--cv-glass-blur);
  animation: cv-slide-in-right 0.4s var(--cv-ease-bounce);
  display: flex;
  align-items: center;
  gap: var(--cv-space-6);
  z-index: var(--cv-z-modal);
}

.bulk-selected-count {
  display: flex;
  align-items: center;
  gap: var(--cv-space-2);
}

.bulk-actions {
  display: flex;
  gap: var(--cv-space-3);
}
```

---

## Payment Components

Financial command center with trust-building aesthetic.

### Balance Card

Large display of wallet balance.

```html
<div class="payment-balance-card">
  <div class="payment-balance-label">Current Balance</div>
  <div class="payment-balance-amount">1,250.00 PC</div>
  <button class="cv-btn-primary" style="margin-top: var(--cv-space-4);">
    Add Funds
  </button>
</div>
```

**CSS** (already in `cybervault-payment.css`):
```css
.payment-balance-card {
  background: var(--cv-glass-2);
  border: var(--cv-border-width) solid var(--cv-cyan-border);
  border-radius: var(--cv-radius-lg);
  padding: var(--pay-balance-padding);
  backdrop-filter: var(--cv-glass-blur);
  box-shadow: var(--cv-glow-cyan-md);
  position: relative;
  overflow: hidden;
}

.payment-balance-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, var(--cv-cyan-glow) 0%, transparent 70%);
  opacity: 0.1;
  pointer-events: none;
}

.payment-balance-label {
  font-size: var(--cv-text-lg);
  color: var(--cv-text-secondary);
  margin-bottom: var(--cv-space-2);
  font-weight: 600;
}

.payment-balance-amount {
  font-family: var(--cv-font-display);
  font-size: clamp(var(--cv-text-3xl), 6vw, var(--cv-text-5xl));
  font-weight: 900;
  color: var(--pay-trust-green);
  text-shadow: 0 0 20px var(--pay-trust-green-glow);
  animation: cv-pulse-glow 3s ease-in-out infinite;
}
```

---

### Product Card

Premium product display for shop.

```html
<div class="payment-product-card">
  <img class="payment-product-image" src="/path/to/product.jpg" alt="Product name" />
  <div class="payment-product-content">
    <h3 class="payment-product-title">Premium Consultation</h3>
    <p class="payment-product-description">
      60-minute one-on-one session with expert guidance on your project.
    </p>
    <div class="payment-product-footer">
      <span class="payment-product-price">500 PC</span>
      <a href="#" class="payment-btn-view-details">Purchase</a>
    </div>
  </div>
</div>
```

**Result**: Glassmorphic card with hover animation, gradient price, and glow effects.

---

### Transaction Success Message

Animated success feedback.

```html
<div class="payment-success-message">
  ✓ Transaction completed successfully! Your balance has been updated.
</div>
```

**CSS** (already in `cybervault-payment.css`):
```css
.payment-success-message {
  background: var(--cv-glass-2);
  border: var(--cv-border-width) solid var(--pay-trust-green);
  border-radius: var(--cv-radius-md);
  padding: var(--cv-space-4);
  color: var(--pay-trust-green);
  font-weight: 600;
  box-shadow: 0 0 20px var(--pay-trust-green-glow);
  animation: success-appear var(--pay-transaction-success-duration) var(--cv-ease-bounce);
}
```

---

## Auth Components

Security gateway aesthetic for authentication.

### Login Card

Secure login form with OAuth.

```html
<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <h1 class="auth-title auth-view-login">Welcome Back</h1>
      <p class="auth-subtitle">Sign in to your account</p>
    </div>

    <form class="auth-form">
      <div class="auth-form-group">
        <label class="auth-label" for="username">Username or Email</label>
        <input
          type="text"
          id="username"
          class="auth-input"
          placeholder="Enter your username..."
          required
        />
      </div>

      <div class="auth-form-group">
        <div class="auth-form-group-with-action">
          <label class="auth-label" for="password">Password</label>
          <a href="#" class="auth-link">Forgot password?</a>
        </div>
        <input
          type="password"
          id="password"
          class="auth-input"
          placeholder="Enter your password..."
          required
        />
      </div>

      <button type="submit" class="auth-btn-primary">
        Sign In
      </button>
    </form>

    <div class="auth-divider">
      <div class="auth-divider-line"></div>
      <span class="auth-divider-text">Or continue with</span>
    </div>

    <button class="auth-btn-oauth">
      <svg class="auth-oauth-icon" viewBox="0 0 24 24">
        <!-- Google icon SVG -->
      </svg>
      Sign in with Google
    </button>

    <div class="auth-footer">
      Don't have an account?
      <a href="#" class="auth-footer-link">Sign up</a>
    </div>
  </div>
</div>
```

**Result**: Centered auth card with animated gradient background, secure input styling, and OAuth integration.

---

### Password Reset Flow

Multi-step password reset interface.

```html
<!-- Forgot Password View -->
<div class="auth-card">
  <div class="auth-header">
    <h1 class="auth-title auth-view-forgot">Reset your password</h1>
    <p class="auth-subtitle">Enter your email to receive a reset link</p>
  </div>

  <form class="auth-form">
    <div class="auth-message auth-message-warning">
      ⚠ Check your email for the reset link
    </div>

    <div class="auth-form-group">
      <label class="auth-label" for="email">Email</label>
      <input
        type="email"
        id="email"
        class="auth-input"
        placeholder="your.email@example.com"
        required
      />
    </div>

    <button type="submit" class="auth-btn-primary">
      Send reset link
    </button>

    <button type="button" class="auth-btn-secondary">
      Back to Sign In
    </button>
  </form>
</div>
```

---

## Theme Customization

### Custom Color Accents

Override design tokens for specific needs:

```css
/* In your app-specific CSS file */
:root {
  /* Custom accent color */
  --app-accent: #ff00ff;
  --app-accent-glow: rgba(255, 0, 255, 0.4);
}

.custom-accent-button {
  background: var(--app-accent);
  box-shadow: 0 0 20px var(--app-accent-glow);
  border-color: var(--app-accent);
}
```

---

### Dark/Light Mode Toggle

The system is dark by default. To add light mode support:

```css
[data-theme="light"] {
  --cv-void: #f5f5f7;
  --cv-text-primary: #1d1d1f;
  --cv-text-secondary: #6e6e73;
  --cv-glass-1: rgba(0, 0, 0, 0.02);
  --cv-glass-2: rgba(0, 0, 0, 0.03);
  /* Override other tokens as needed */
}
```

```javascript
// Toggle theme
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  html.setAttribute('data-theme', currentTheme === 'light' ? 'dark' : 'light');
}
```

---

### Animation Preferences

Respect user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is already included in all theme files.

---

## Design Token Reference

### Quick Reference Table

| Token | Value | Usage |
|-------|-------|-------|
| `--cv-void` | `#030408` | Background color |
| `--cv-cyan` | `#00f2ff` | Primary accent |
| `--cv-purple` | `#bc13fe` | Secondary accent |
| `--cv-text-primary` | `#f0f0f3` | Main text |
| `--cv-text-secondary` | `#b0b0b8` | Secondary text |
| `--cv-glass-1` | `rgba(255,255,255,0.02)` | Subtle glass |
| `--cv-glass-2` | `rgba(255,255,255,0.03)` | Medium glass |
| `--cv-glass-strong` | `rgba(255,255,255,0.08)` | Strong glass |
| `--cv-radius-sm` | `4px` | Small border radius |
| `--cv-radius-md` | `8px` | Medium border radius |
| `--cv-radius-lg` | `12px` | Large border radius |
| `--cv-radius-full` | `9999px` | Pill shape |
| `--cv-space-2` | `8px` | Small spacing |
| `--cv-space-4` | `16px` | Medium spacing |
| `--cv-space-8` | `32px` | Large spacing |

---

## Integration Checklist

- [ ] Import Cybervault base CSS
- [ ] Import app-specific theme CSS
- [ ] Replace existing color classes with Cybervault tokens
- [ ] Update button styles to use `.cv-btn-*` classes
- [ ] Convert cards to use `.cv-glass` backgrounds
- [ ] Add glow effects to interactive elements
- [ ] Test with `prefers-reduced-motion`
- [ ] Test with `prefers-contrast: high`
- [ ] Verify focus states for accessibility
- [ ] Update build process to include new CSS files

---

## Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (requires `-webkit-` prefixes for `background-clip`)
- **Mobile browsers**: Full support with touch-friendly hit areas

---

## Performance Tips

1. **CSS Variables**: Already optimized for minimal repaints
2. **Animations**: Use `transform` and `opacity` for hardware acceleration
3. **Blur effects**: Backdrop-filter can be expensive; use sparingly
4. **Glow shadows**: Multiple box-shadows are cached by browsers

---

## Need Help?

This design system is fully implemented in:
- `/shared-design-system/cybervault.css` - Base system
- `/l2p/frontend/src/cybervault-l2p.css` - Gaming theme
- `/VideoVault/client/src/styles/cybervault-videovault.css` - Media theme
- `/payment/app/cybervault-payment.css` - Financial theme
- `/auth/frontend/src/styles/cybervault-auth.css` - Security theme

Refer to these files for complete implementations and additional components.
