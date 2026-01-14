# PatrickCoin Payment Platform - Keyboard Shortcuts

Complete guide to keyboard navigation for secure, accessible financial transactions.

---

## Universal Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Activate button or link, submit form |
| `Space` | Activate button |
| `Esc` | Close modal, cancel transaction |

---

## Home/Landing Page

### Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate header → hero CTAs → features |
| `Enter` on Browse Shop | Navigate to shop page |
| `Enter` on Get Started | Navigate to login/register |

### Header Navigation
- **Tab** to PatrickCoin logo → **Enter** to return home
- **Tab** to Shop → **Enter** to browse products
- **Tab** to Wallet → **Enter** to manage funds (if logged in)
- **Tab** to Orders → **Enter** to view order history
- **Tab** to Admin → **Enter** for admin panel (admin only)

---

## Shop Page

### Product Grid Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate through product cards (left→right, top→bottom) |
| `Enter` on product | View product details |
| `Enter` on View Details | Open product detail page |
| `Shift+Tab` | Navigate backwards through products |

### Product Cards
- **Focus indicator**: Cyan border with glow effect on hover
- **Grid layout**: Automatic responsive adjustment
- **Card activation**: Enter or click opens detail page

### Filtering & Search (if implemented)
- **Tab** to search input
- **Type** to filter products
- **Tab** to category filter
- **Arrow keys** in dropdown to select category

---

## Product Detail Page

### Product Actions
| Shortcut | Action |
|----------|--------|
| `Tab` through details | Navigate price → description → purchase button |
| `Enter` on quantity | Edit quantity field |
| `↑↓` in quantity | Adjust item count (if number input) |
| `Tab` to Purchase | Focus purchase button |
| `Enter` on Purchase | Add to cart / initiate purchase |

### Navigation
- **Esc** or **Back button**: Return to shop
- **Tab** to related products: Browse similar items

---

## Wallet Management

### Balance Overview
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate balance display → Add Funds button |
| `Enter` on Add Funds | Open payment form |
| Balance amount | Not focusable (read-only display) |

### Add Funds Form
| Shortcut | Action |
|----------|--------|
| `Tab` to amount field | Focus amount input |
| Type amount | Enter desired funds (e.g., "100") |
| `Tab` to payment method | Focus payment dropdown |
| `↑↓` in dropdown | Select payment method |
| `Tab` to card details | Focus Stripe payment fields |

### Stripe Checkout Payment (Issue #3 - VERIFIED ✓)
This application uses **Stripe Checkout** (hosted payment page), which is fully keyboard-accessible by design.

**Workflow to Stripe Checkout:**

| Shortcut | Action |
|----------|--------|
| `Tab` to amount field | Focus amount input |
| Type number | Enter desired funds (e.g., "100") |
| `Tab` to Pay button | Focus "Pay with Card (Stripe)" button |
| `Enter` on button | Redirect to Stripe Checkout |

**On Stripe Checkout page** (Stripe-hosted):
- Full keyboard navigation built-in
- Tab through card number → expiry → CVC → ZIP
- All fields keyboard-editable
- Enter to submit payment
- Escape to cancel

**Note**: Stripe Checkout is PCI-compliant and maintains full accessibility standards. The hosted page is managed and tested by Stripe.

### Transaction Feedback
- **Success**: Green message appears, focus returns to balance
- **Error**: Red error message appears, focus stays on form
- **Loading**: Button shows loading state, cannot re-submit

---

## Orders Page

### Order History
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate through order list |
| `Enter` on order | View order details |
| `Tab` through details | Navigate order information |

### Order Actions
- **Tab** to View Receipt → **Enter** to download/view
- **Tab** to Reorder → **Enter** to add items to cart again
- **Tab** to Support → **Enter** to contact customer service

---

## Admin Panel (Admin Users Only)

### Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate admin sections |
| `Enter` on section | Expand/collapse admin area |
| `Tab` to New Product | Focus create product button |
| `Enter` | Open product creation form |

### Product Management (Coming Soon - Issue #1)
| Shortcut | Action |
|----------|--------|
| `Tab` through products | Navigate product list |
| `Enter` on product | Edit product details |
| `Tab` to Delete | Focus delete button |
| `Enter` + Confirm | Delete product |

**Admin Dropdown** (if implemented):
- **Tab** to Admin link
- **Enter** or **Space** to open dropdown
- **↑↓** to navigate dropdown items
- **Enter** to select option

---

## Login & Authentication

### Login Form
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate email → password → submit |
| Type credentials | Enter email and password |
| `Enter` in any field | Submit login form |
| `Tab` to Forgot Password | Focus recovery link |
| `Tab` to Sign Up | Focus registration link |

### Registration
- **Tab** through all fields: Name → Email → Password → Confirm
- **Enter** in any field: Submit registration
- **Tab** to Terms checkbox → **Space** to toggle
- **Tab** to Sign In link: Return to login

---

## Checkout Flow (if implemented)

### Cart Review
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate cart items |
| `Tab` to quantity | Adjust item quantity |
| `↑↓` in quantity | Change count |
| `Tab` to Remove | Delete item from cart |
| `Tab` to Checkout | Proceed to payment |

### Payment & Confirmation
- **Tab** through shipping form
- **Tab** through payment details
- **Tab** to Place Order button
- **Enter** to complete purchase
- **Success page**: Tab to Continue Shopping or View Order

---

## Accessibility Features

### Focus Indicators
All interactive elements have **cyan or purple focus indicators**:

- **Buttons**: Cyan gradient glow with 2px outline
- **Links**: Purple underline on focus
- **Form inputs**: Purple border changes to cyan on focus
- **Product cards**: Cyan border with shadow glow
- **Navigation**: Cyan underline animation

### Transaction Security Indicators
- **Lock icons**: Visible on secure payment fields
- **SSL badge**: Shown during checkout
- **Focus rings**: Extra prominent on payment fields
- **Error states**: Red border with clear error messages

### Reduced Motion
When "Reduce motion" is enabled in system settings:
- **Hero animations**: Static background, no animation
- **Product cards**: Instant state change (no hover animation)
- **Transitions**: Immediate instead of animated
- **Loading**: Simplified spinner

Enable in:
- **Windows**: Settings → Accessibility → Visual effects
- **macOS**: System Preferences → Accessibility → Display
- **Linux**: Desktop environment accessibility settings

### High Contrast Mode
When high contrast is enabled:
- **Borders**: Increase to 2px for all elements
- **Focus rings**: Thicker, higher contrast
- **Buttons**: Stronger border definition
- **Error states**: Enhanced red borders

---

## Form Validation & Errors

### Error Handling (Issue #5 - Enhancement Planned)
Current behavior:
- Error message appears above form
- Invalid fields show red border
- Error text displayed below field

Planned enhancement:
- **Focus moves to first error** automatically
- **ARIA invalid** attributes on fields
- **Screen reader announcements** for errors

### Validation States
| State | Visual Indicator |
|-------|------------------|
| Valid | Green border (if shown) |
| Invalid | Red border + error message |
| Required | Asterisk (*) in label |
| Focus | Cyan border + glow shadow |

---

## Tips for Efficient Shopping

### Keyboard-First Workflow
1. **Navigate with Tab**: Faster than mouse for forms
2. **Enter to submit**: Quick form submission
3. **Arrow keys in dropdowns**: Fast selection
4. **Esc to cancel**: Quick exit from modals

### Secure Payment Entry
1. **Tab through payment form**: Verify all fields
2. **Double-check amount**: Before submitting
3. **Use Esc to cancel**: If you need to stop
4. **Wait for confirmation**: Don't refresh during payment

### Order Management
1. **Keyboard navigation**: Faster order review
2. **Tab through history**: Quick order lookup
3. **Enter to view details**: Instant order info
4. **Reorder shortcut**: Quick repeat purchases

---

## Known Issues & Roadmap

### High Priority

**Issue #3**: Stripe Elements keyboard accessibility testing
- **Status**: Needs verification
- **Impact**: Payment form keyboard navigation
- **Action**: Testing Stripe iframe keyboard support
- **ETA**: Sprint 1

### Medium Priority

**Issue #1**: Admin dropdown keyboard navigation
- **Status**: Needs implementation
- **Impact**: Admin menu accessibility
- **Workaround**: Click admin link to navigate
- **ETA**: Sprint 2

**Issue #2**: Product images focus management
- **Status**: Minor improvement
- **Impact**: Decorative images may receive focus
- **Fix**: Add aria-hidden to images
- **ETA**: Sprint 3

---

## Keyboard Navigation Testing

### Self-Test Checklist
Verify keyboard accessibility by testing these scenarios:

- [ ] **Home page**: Tab through all CTAs, Enter activates
- [ ] **Shop**: Tab through products, Enter opens details
- [ ] **Product detail**: Tab through, Enter purchases
- [ ] **Wallet**: Tab to Add Funds, complete payment form
- [ ] **Login**: Tab through fields, Enter submits
- [ ] **Admin** (if admin): Tab through controls
- [ ] **Focus visible**: Cyan/purple ring on all elements
- [ ] **Forms**: All fields accessible via Tab
- [ ] **Errors**: Error messages visible and readable

### Payment Form Testing
**Critical**: Test Stripe Elements keyboard navigation:
1. Navigate to Wallet → Add Funds
2. Tab through amount → payment method → card fields
3. Verify each Stripe field receives focus
4. Test typing in card number, expiry, CVC
5. Verify Tab order makes sense
6. Report any keyboard traps or inaccessible fields

### Report Issues
Found a keyboard problem?
1. **Note location**: Page, component, specific field
2. **Describe issue**: Expected vs actual behavior
3. **Security note**: If payment-related, mark as high priority
4. **Report via**: GitHub Issues with "keyboard-navigation" label

---

## Security & Accessibility

### Secure Keyboard Navigation
- **No keyboard logging**: Your keystrokes are secure
- **HTTPS only**: All payment forms encrypted
- **Focus indicators**: Don't reveal sensitive data
- **Screen reader safe**: Payment info not exposed

### PCI Compliance
- **Stripe handles sensitive data**: Card numbers not stored locally
- **Keyboard input secure**: Direct to Stripe, not intercepted
- **Focus management**: Doesn't compromise security

### Privacy
- **No keystroke tracking**: We don't log keyboard input
- **Secure forms**: All inputs encrypted in transit
- **Session security**: Auto-logout on inactivity

---

## Future Enhancements

### Planned Features
- **Quick checkout**: Ctrl+Enter to fast-purchase
- **Saved payment methods**: Number keys to select (1-9)
- **Search focus**: Ctrl+K for instant product search
- **Cart management**: Keyboard shortcuts for add/remove
- **Order filtering**: Keyboard-accessible date ranges

### Community Requests
Vote on features you'd like:
- Keyboard-driven product comparison
- Quick-add to cart from shop grid
- Keyboard shortcuts for price sorting
- Accessibility improvements for colorblind users

---

## Getting Help

### Documentation
- **Full test guide**: `/shared-infrastructure/shared/design-system/KEYBOARD_NAVIGATION_TEST.md`
- **Issue tracker**: `/ACCESSIBILITY_ISSUES.md`
- **Design system**: `/shared-infrastructure/shared/design-system/cybervault.css`

### Support
- **Keyboard issues**: Report via GitHub with "keyboard-navigation" label
- **Payment problems**: Contact support with transaction details
- **Accessibility**: Use "accessibility" label for a11y issues

### Resources
- [Stripe Accessibility](https://stripe.com/docs/accessibility)
- [WebAIM Keyboard Guide](https://webaim.org/articles/keyboard/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Last Updated**: 2026-01-10
**Version**: 1.0.0
**Design System**: Cybervault
**Security**: PCI DSS Compliant (Stripe)
**Accessibility**: WCAG 2.1 Level AA (in progress)
