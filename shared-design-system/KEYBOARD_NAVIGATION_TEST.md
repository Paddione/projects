# Cybervault Design System - Keyboard Navigation Test Guide

This guide provides keyboard navigation testing procedures for all applications using the Cybervault design system.

## Test Objectives

- Verify all interactive elements are keyboard accessible
- Ensure focus states are clearly visible
- Confirm logical tab order throughout the interface
- Test keyboard shortcuts and interactions

---

## General Keyboard Navigation Standards

### Focus Indicator Requirements

All interactive elements must have a visible focus state defined by:

```css
:focus-visible {
  outline: 2px solid var(--cv-cyan);
  outline-offset: 2px;
}
```

**Expected behavior**:
- Focus ring appears on `Tab` navigation (not on mouse click)
- Ring color: Cyan (#00f2ff)
- Ring thickness: 2px
- Offset from element: 2px

### Standard Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next interactive element |
| `Shift+Tab` | Move focus to previous interactive element |
| `Enter` | Activate focused button/link |
| `Space` | Activate focused button, toggle checkbox |
| `Esc` | Close modals, cancel actions |
| `Arrow keys` | Navigate within component groups |

---

## L2P Application Testing

### Home Page

**Tab order should be**:
1. Skip to main content link (appears on focus)
2. Navigation menu items
3. "Create Lobby" button
4. "Join Lobby" button
5. Login/Profile button

**Test procedure**:
```
1. Load homepage
2. Press Tab - verify skip link appears
3. Continue tabbing - verify each element receives visible focus
4. Press Enter on "Create Lobby" - verify navigation
5. Use Shift+Tab to navigate backwards - verify reverse order
```

**Pass criteria**:
- [ ] All interactive elements focusable
- [ ] Focus order matches visual layout
- [ ] Focus indicator visible on all elements
- [ ] Enter key activates buttons

### Lobby Page

**Tab order should be**:
1. Lobby code display (not focusable, for screen readers)
2. "Copy Code" button
3. "Start Game" button (if host)
4. Player list items (optional focus for selection)
5. "Leave Lobby" button

**Test procedure**:
```
1. Join a lobby
2. Press Tab through all controls
3. Verify "Start Game" disabled state when not enough players
4. Press Enter on "Copy Code" - verify code copied
5. Arrow keys to navigate player list (if implemented)
```

**Pass criteria**:
- [ ] Buttons receive focus in logical order
- [ ] Disabled buttons show disabled focus state
- [ ] Enter activates "Start Game"
- [ ] Player selection works with keyboard

### Game Page

**Tab order should be**:
1. Question text (for screen readers, not focusable)
2. Answer option A
3. Answer option B
4. Answer option C
5. Answer option D
6. Timer display (not focusable)
7. Score display (not focusable)

**Test procedure**:
```
1. Start a game
2. Press Tab to focus first answer
3. Use Arrow keys to navigate between answers
4. Press Space or Enter to select answer
5. Verify visual feedback on selection
6. Test during countdown timer
```

**Pass criteria**:
- [ ] Answer options focusable with Tab
- [ ] Arrow keys navigate between answers
- [ ] Space/Enter selects answer
- [ ] Selected answer shows visual state
- [ ] Correct/incorrect states visible

### Results Page

**Tab order should be**:
1. Final scores display
2. Winner announcement
3. "Play Again" button
4. "Return to Lobby" button
5. "Go Home" button

**Test procedure**:
```
1. Complete a game
2. Tab through results screen
3. Press Enter on each button
4. Verify navigation works correctly
```

**Pass criteria**:
- [ ] All navigation buttons focusable
- [ ] Enter key navigates correctly
- [ ] Focus order matches visual importance

---

## VideoVault Application Testing

### Video Grid Page

**Tab order should be**:
1. Search input
2. Category filter dropdown
3. Sort dropdown
4. First video card
5. Subsequent video cards (in grid order, left-to-right, top-to-bottom)
6. Pagination controls

**Test procedure**:
```
1. Load video library
2. Tab through filters
3. Tab through video grid
4. Press Enter on a video - verify modal opens
5. Test with 100+ videos (virtualized grid)
```

**Pass criteria**:
- [ ] Filters focusable and operable
- [ ] Video cards in logical tab order
- [ ] Enter opens video detail
- [ ] Virtualized items become focusable when scrolled into view
- [ ] Grid navigation works with keyboard

### Video Player Modal

**Tab order should be**:
1. Close button (X)
2. Play/Pause button
3. Volume control
4. Progress bar
5. Fullscreen button
6. Category tags
7. Edit button

**Test procedure**:
```
1. Open a video
2. Press Esc - verify modal closes
3. Reopen video
4. Tab through controls
5. Press Space on Play/Pause - verify playback toggles
6. Press Arrow keys on progress bar - verify seek
```

**Pass criteria**:
- [ ] Esc closes modal
- [ ] All player controls keyboard accessible
- [ ] Space toggles playback
- [ ] Arrow keys seek (Left/Right = ±5s, Up/Down = volume)
- [ ] F key toggles fullscreen (if implemented)

### Bulk Selection Mode

**Tab order should be**:
1. "Select All" checkbox
2. Individual video checkboxes (in grid order)
3. Bulk actions bar (when items selected):
   - Add Tags button
   - Move to Collection button
   - Delete button
   - Cancel button

**Test procedure**:
```
1. Press Tab to first video
2. Press Space to select video
3. Verify bulk actions bar appears
4. Tab to bulk actions
5. Press Enter on action button
```

**Pass criteria**:
- [ ] Space toggles video selection
- [ ] Bulk actions bar keyboard accessible
- [ ] Enter activates bulk operations
- [ ] Esc cancels bulk mode

---

## Payment Application Testing

### Home Page (Landing)

**Tab order should be**:
1. Logo (navigation)
2. Shop link
3. Wallet link (if logged in)
4. Orders link (if logged in)
5. Admin link (if admin)
6. Sign Out button (if logged in) OR Login button
7. "Browse Shop" CTA button
8. "Get Started" CTA button

**Test procedure**:
```
1. Load homepage
2. Tab through navigation
3. Tab through hero CTAs
4. Press Enter on each link - verify navigation
```

**Pass criteria**:
- [ ] Navigation focusable
- [ ] Hero buttons accessible
- [ ] Enter activates navigation

### Shop Page

**Tab order should be**:
1. Navigation (inherited from header)
2. First product card
3. Subsequent product cards (grid order)
4. "View Details" button on each card

**Test procedure**:
```
1. Navigate to shop
2. Tab through product grid
3. Press Enter on "View Details" - verify navigation
4. Test with multiple product pages
```

**Pass criteria**:
- [ ] Product cards focusable
- [ ] Grid navigation logical
- [ ] Enter activates product detail

### Wallet Page

**Tab order should be**:
1. Navigation
2. Balance display (not focusable)
3. "Add Funds" button
4. Amount input
5. Payment method dropdown
6. "Submit Payment" button

**Test procedure**:
```
1. Navigate to wallet
2. Tab through form fields
3. Enter amount with keyboard
4. Use Arrow keys in dropdown
5. Press Enter to submit
```

**Pass criteria**:
- [ ] Form fields keyboard accessible
- [ ] Dropdown operable with keyboard
- [ ] Enter submits form
- [ ] Validation errors announced

---

## Auth Application Testing

### Login Page

**Tab order should be**:
1. Username/Email input
2. Password input
3. "Forgot password?" link
4. "Sign In" button
5. "Sign in with Google" button
6. "Sign up" link

**Test procedure**:
```
1. Load login page
2. Tab through form
3. Enter credentials with keyboard
4. Press Enter to submit
5. Test with validation errors
```

**Pass criteria**:
- [ ] All form fields focusable
- [ ] Enter submits form
- [ ] Validation errors visible and announced
- [ ] OAuth button keyboard accessible

### Register Page

**Tab order should be**:
1. Full Name input (optional)
2. Username input
3. Password input
4. Email input
5. "Sign Up" button
6. "Sign up with Google" button
7. "Sign in" link

**Test procedure**:
```
1. Navigate to register page
2. Tab through form
3. Fill fields with keyboard
4. Press Enter to submit
5. Test password validation feedback
```

**Pass criteria**:
- [ ] Form fields in logical order
- [ ] Password strength indicator visible
- [ ] Enter submits registration
- [ ] Errors clearly indicated

### Password Reset Flow

**Forgot Password Tab Order**:
1. Email input
2. "Send reset link" button
3. "Back to Sign In" button

**Reset Password Tab Order**:
1. Reset Token input
2. New Password input
3. Confirm Password input
4. "Reset Password" button
5. "Back to Sign In" button

**Test procedure**:
```
1. Click "Forgot password?"
2. Tab through forgot form
3. Submit email
4. Tab through reset form
5. Enter new password
6. Press Enter to submit
```

**Pass criteria**:
- [ ] All form fields accessible
- [ ] Multi-step flow navigable
- [ ] Success/error states visible
- [ ] Back navigation works

---

## Universal Component Tests

### Buttons

**Test all button variants**:
- `.cv-btn-primary`
- `.cv-btn-accent-cyan`
- `.cv-btn-accent-purple`
- `.payment-btn-primary`
- `.auth-btn-primary`

**Test procedure**:
```
1. Tab to button
2. Verify focus ring appears
3. Press Enter - verify action
4. Press Space - verify action
5. Test disabled state - verify no action
```

**Pass criteria**:
- [ ] Focus ring visible (cyan, 2px)
- [ ] Enter activates button
- [ ] Space activates button
- [ ] Disabled buttons not activatable

### Form Inputs

**Test all input variants**:
- `.auth-input`
- `.payment-form-input`
- Text inputs
- Select dropdowns
- Checkboxes
- Radio buttons

**Test procedure**:
```
1. Tab to input
2. Type with keyboard
3. Use Arrow keys in selects
4. Press Space on checkboxes
5. Verify input validation
```

**Pass criteria**:
- [ ] Focus border changes color (cyan/purple)
- [ ] Keyboard input works
- [ ] Dropdowns navigable with arrows
- [ ] Space toggles checkboxes
- [ ] Validation errors visible

### Cards

**Test all card variants**:
- `.cv-glass` (base card)
- `.video-card`
- `.payment-product-card`
- `.player-card`

**Test procedure**:
```
1. Tab to card
2. Verify hover state on focus
3. Press Enter to activate (if clickable)
4. Verify card actions accessible
```

**Pass criteria**:
- [ ] Cards receive focus (if interactive)
- [ ] Hover effects apply on focus
- [ ] Enter activates card action
- [ ] Non-interactive cards not focusable

### Modals

**Test procedure**:
```
1. Open modal
2. Verify focus trapped inside modal
3. Tab through modal controls
4. Press Esc - verify modal closes
5. Verify focus returns to trigger element
```

**Pass criteria**:
- [ ] Focus trapped in modal
- [ ] Tab cycles within modal
- [ ] Esc closes modal
- [ ] Focus restoration on close
- [ ] Close button (X) focusable

---

## Accessibility Features Built Into Design System

### Focus Indicators

All interactive elements have visible focus states:

```css
.auth-input:focus-visible,
.payment-form-input:focus-visible,
.cv-btn-primary:focus-visible {
  outline: 2px solid var(--cv-cyan);
  outline-offset: 2px;
}
```

### Reduced Motion Support

Users who prefer reduced motion get minimal animations:

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

**Test procedure**:
```
1. Enable "Reduce motion" in OS settings
2. Reload application
3. Verify animations are minimal
4. Test all transitions
```

### High Contrast Mode

Design system respects high contrast preferences:

```css
@media (prefers-contrast: high) {
  .auth-card,
  .payment-product-card {
    border-width: 2px;
  }
}
```

---

## Testing Checklist

### Before Testing
- [ ] Clear browser cache
- [ ] Disable mouse/trackpad (optional, for focused testing)
- [ ] Open browser DevTools Accessibility panel
- [ ] Enable OS screen magnification (optional)

### During Testing
- [ ] Document any unreachable elements
- [ ] Note focus order issues
- [ ] Screenshot poor focus visibility
- [ ] Record keyboard shortcuts that don't work

### After Testing
- [ ] File issues for keyboard navigation problems
- [ ] Update components with focus improvements
- [ ] Retest after fixes
- [ ] Document keyboard shortcuts in app help

---

## Common Issues and Fixes

### Issue: Focus not visible
**Fix**: Verify element has `:focus-visible` pseudo-class styling

### Issue: Tab order illogical
**Fix**: Check HTML source order; use `tabindex="0"` for custom elements

### Issue: Button not activatable with Enter
**Fix**: Use `<button>` element, not `<div>` with click handler

### Issue: Dropdown not keyboard navigable
**Fix**: Use native `<select>` or implement ARIA combobox pattern

### Issue: Modal focus not trapped
**Fix**: Implement focus trap with `tabindex` management

---

## Test Results Template

```markdown
## [Application Name] Keyboard Navigation Test Results

**Tester**: [Name]
**Date**: [YYYY-MM-DD]
**Browser**: [Chrome/Firefox/Safari + version]
**OS**: [Windows/Mac/Linux]

### Passed Tests
- [ ] Home page navigation
- [ ] Form inputs
- [ ] Button activation
- [ ] Modal interaction
- [ ] [Other tests...]

### Failed Tests
1. **Issue**: [Description]
   - **Expected**: [What should happen]
   - **Actual**: [What happened]
   - **Reproduction**: [Steps]

### Recommendations
- [Improvement suggestions]
- [Accessibility enhancements]
```

---

## Resources

- [WebAIM Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [W3C ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Keyboard-navigable JavaScript widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets)

---

## Integration with CI/CD

Consider adding automated keyboard navigation tests using Playwright:

```typescript
test('keyboard navigation through login form', async ({ page }) => {
  await page.goto('/login');

  // Tab through form
  await page.keyboard.press('Tab'); // Focus username
  await expect(page.locator('#username')).toBeFocused();

  await page.keyboard.press('Tab'); // Focus password
  await expect(page.locator('#password')).toBeFocused();

  await page.keyboard.press('Tab'); // Focus submit button
  await expect(page.locator('button[type="submit"]')).toBeFocused();

  // Submit with Enter
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/apps');
});
```

---

**Last Updated**: 2026-01-10
**Design System Version**: 1.0.0
