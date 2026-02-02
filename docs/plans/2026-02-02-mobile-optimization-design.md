# Mobile Optimization Design — All Projects

**Date**: 2026-02-02
**Scope**: Essential fixes for mobile access across L2P, Payment, and VideoVault
**Approach**: Fix biggest pain points — collapsible nav, missing breakpoints, touch targets, overflow

---

## 1. Payment Project

### 1.1 Hamburger Menu (Header)
- Add mobile menu toggle button visible below 768px
- Nav links shown in dropdown panel beneath header on toggle
- Desktop nav unchanged (horizontal links)
- Implementation in `payment/components/header.tsx` + `payment/app/cybervault-payment.css`

### 1.2 Admin Sidebar Collapse
- Below 768px: sidebar becomes slide-in overlay drawer
- Add toggle button in admin content area
- Sidebar: `position: fixed; transform: translateX(-100%)` on mobile
- Backdrop overlay when open
- Implementation in `payment/app/admin/layout.tsx` + `payment/app/cybervault-payment.css`

### 1.3 Additional Breakpoint (480px)
- Single-column product grid
- Reduced padding/spacing
- Smaller hero section
- Implementation in `payment/app/cybervault-payment.css`

### 1.4 Touch Target Fixes
- Ensure all interactive elements meet 44px minimum touch target
- Check nav links, buttons, form inputs

---

## 2. L2P Project

### 2.1 Header Hamburger Menu
- Below 640px: nav collapses to hamburger toggle
- Logo stays visible, toggle on right
- Volume controls become icon-only or move into menu
- Implementation in `l2p/frontend/src/components/Header.tsx` + `l2p/frontend/src/styles/Header.module.css`

### 2.2 Layout Tightening (480px breakpoint)
- Lobby page: tighter padding on small phones
- Home page: tighter grid spacing
- Auth forms: reduced padding
- Implementation in relevant `.module.css` files

---

## 3. VideoVault Project

### 3.1 Video Player Modal — Mobile Fullscreen
- Below 768px: modal becomes full-screen
- Remove side padding so video fills width
- Implementation in `VideoVault/client/src/styles/cybervault-videovault.css`

### 3.2 Bulk Operations Bar — Safe Area
- Add `padding-bottom: env(safe-area-inset-bottom)` for iOS
- Ensure bar not cut off by browser chrome
- Implementation in `VideoVault/client/src/styles/cybervault-videovault.css`

### 3.3 Header Stats — Earlier Hiding
- Hide stats text at 640px (not 768px)
- Keep icons visible
- Implementation in `VideoVault/client/src/styles/cybervault-videovault.css`

---

## Implementation Order
1. Payment (most impact)
2. L2P (moderate impact)
3. VideoVault (polish)
