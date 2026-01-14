# Unified Auth - Keyboard Shortcuts

Complete guide to keyboard navigation for secure authentication flows.

---

## Universal Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Submit form, activate button or link |
| `Space` | Activate button (not for form submit) |
| `Esc` | Cancel action, close modal, clear focus |

---

## Login Page

### Form Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate username → password → submit button |
| Type in fields | Enter credentials |
| `Enter` in any field | Submit login form |
| `Tab` to Forgot Password | Focus password recovery link |
| `Tab` to OAuth button | Focus Google Sign-In |
| `Tab` to Sign Up | Focus registration link |

### Login Flow
```
1. Tab → Focus username/email field
2. Type username → Enter credentials
3. Tab → Focus password field
4. Type password → Enter password
5. Tab → Focus "Sign In" button
6. Enter → Submit login
```

### Alternative Flow
- **Enter in username**: Moves to password
- **Enter in password**: Submits form (fastest method)
- **Tab to Forgot Password**: Use when password unknown
- **Tab to Google Sign-In**: OAuth authentication

---

## Registration Page

### Form Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate name → username → email → password → submit |
| Type in fields | Enter registration details |
| `Enter` in any field | Submit registration form |
| `Tab` to Sign In | Return to login page |

### Registration Flow
```
1. Tab → Focus full name field (optional)
2. Type name → Enter your name
3. Tab → Focus username field
4. Type username → Choose username
5. Tab → Focus email field
6. Type email → Enter email address
7. Tab → Focus password field
8. Type password → Create secure password
9. Tab → Focus "Sign Up" button
10. Enter → Submit registration
```

### Password Requirements
As you type your password:
- **Visual strength bar**: Shows password strength (weak/medium/strong)
- **Hint text**: Displays requirements below field
- **Color coding**:
  - Red bars = Weak password
  - Yellow bars = Medium password
  - Green bars = Strong password

**Requirements**: 8+ characters with uppercase, lowercase, number, and special character (@$!%*?&)

---

## Password Reset Flow

### Forgot Password
| Shortcut | Action |
|----------|--------|
| Click "Forgot password?" | Navigate to reset request form |
| `Tab` to email field | Focus email input |
| Type email | Enter account email |
| `Enter` in field | Submit reset request |
| `Tab` to "Back to Sign In" | Return to login |

### Forgot Password Flow
```
1. From login page → Click "Forgot password?"
2. Tab → Focus email field
3. Type email → Enter your email
4. Tab → Focus "Send reset link" button
5. Enter → Submit request
6. Check email for reset token
```

### Reset Password
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate token → new password → confirm → submit |
| Type in fields | Enter reset token and new password |
| `Enter` in field | Submit password reset |
| `Tab` to "Back to Sign In" | Return to login after reset |

### Reset Password Flow
```
1. Receive reset token via email
2. Tab → Focus reset token field
3. Type/paste token → Enter reset token
4. Tab → Focus new password field
5. Type password → Create new password
6. Tab → Focus confirm password field
7. Type password again → Confirm password
8. Tab → Focus "Reset Password" button
9. Enter → Submit password reset
10. Tab to "Back to Sign In" → Return to login
```

---

## OAuth Authentication

### Google Sign-In
| Shortcut | Action |
|----------|--------|
| `Tab` to "Sign in with Google" | Focus OAuth button |
| `Enter` or `Space` | Initiate Google OAuth flow |
| Browser redirects | Google handles authentication |
| Auto-return | Returns to app after auth |

### OAuth Flow
```
1. From login or register page
2. Tab to "Sign in/up with Google" button
3. Enter → Opens Google OAuth
4. Google's keyboard navigation (external)
5. Approve access → Returns to app
6. Auto-login → Redirected to app
```

---

## Multi-Step Forms

### View Transitions
| View | Tab Order |
|------|-----------|
| **Login** | Username → Password → Forgot link → Submit → OAuth → Sign Up |
| **Forgot** | Email → Submit → Back button |
| **Reset** | Token → New Password → Confirm → Submit → Back |
| **Register** | Name → Username → Email → Password → Submit → OAuth → Sign In |

### Switching Views
All view transitions maintain keyboard focus:
- **Forgot password link**: Tab + Enter from login
- **Back to Sign In**: Tab + Enter from forgot/reset
- **Sign Up link**: Tab + Enter from login
- **Sign In link**: Tab + Enter from register

---

## Form Validation & Errors

### Error Handling (Current)
When form submission fails:
- Error message appears at top of form
- Invalid fields show red border
- Error text appears with red styling
- Focus remains on submit button

### Error Handling (Enhanced - Issue #4, #5)
Planned improvements:
- **Focus moves to first error** automatically
- **ARIA invalid** attributes on fields
- **Screen reader announcements** for errors
- **Field descriptions** linked with aria-describedby

### Validation States
| State | Visual Indicator |
|-------|------------------|
| **Normal** | Purple border, no glow |
| **Focus** | Purple glow shadow |
| **Valid** | No special indicator (optional green check) |
| **Invalid** | Red border + error text below |
| **Required** | Asterisk in label (if shown) |

### Error Message Navigation
```
1. Submit form with errors
2. Error message appears
3. [Future] Focus moves to first invalid field
4. Tab through invalid fields
5. Fix errors
6. Tab to submit button
7. Enter → Resubmit form
```

---

## Password Strength Indicator

### Current Behavior
Visual-only password strength bars:
- 4 bars show below password field
- Bars fill based on password strength
- Color changes: red (weak) → yellow (medium) → green (strong)

### Enhanced Behavior (Issue #4 - Planned)
Announced password strength for screen readers:
- **ARIA live region**: Announces strength changes
- **Polite announcements**: Doesn't interrupt typing
- **Clear messaging**: "Password strength: weak/medium/strong"

---

## Accessibility Features

### Focus Indicators
All interactive elements show **purple focus ring** (2px):

- **Form inputs**: Purple border intensifies, adds glow
- **Buttons**: Purple outline with 2px offset
- **Links**: Underline appears on focus
- **OAuth buttons**: Cyan border highlight

### Focus Visibility
Design ensures focus is always visible:
- **High contrast**: 2px outline against dark background
- **Color coding**: Purple (auth theme color)
- **Glow effects**: Additional shadow for emphasis
- **Animation**: Smooth transition on focus

### Reduced Motion
When "Reduce motion" enabled:
- **Page transitions**: Instant instead of fade
- **Focus animations**: No smooth transitions
- **Loading states**: Simplified spinner
- **Success/error**: Immediate display, no animation

Enable in:
- **Windows**: Settings → Accessibility → Visual effects
- **macOS**: System Preferences → Accessibility → Display → Reduce motion
- **Linux**: Desktop environment accessibility settings

### High Contrast Mode
When high contrast enabled:
- **Form borders**: Increase to 2px width
- **Focus rings**: Thicker, higher contrast outlines
- **Error indicators**: Enhanced red borders
- **Button borders**: Stronger definition

---

## Security & Privacy

### Secure Keyboard Navigation
- **HTTPS only**: All forms encrypted in transit
- **No keystroke logging**: Input not tracked or stored
- **Focus indicators**: Don't reveal sensitive data
- **Password fields**: Masked with bullets (••••)

### Session Security
- **Auto-logout**: Inactive sessions expire
- **Token expiration**: Reset tokens have time limits
- **Focus management**: Secure even when visible

### OAuth Security
- **Redirects secure**: HTTPS throughout OAuth flow
- **State validation**: CSRF protection built-in
- **Keyboard safe**: Tab navigation doesn't compromise security

---

## Tips for Efficient Login

### Speed Techniques
1. **Enter to advance**: Press Enter after each field
2. **Tab + Type**: Quick field navigation
3. **Password managers**: Use Ctrl+Shift+L (varies by browser)
4. **OAuth**: Fastest for returning users

### Security Best Practices
1. **Strong passwords**: 12+ characters recommended
2. **Password managers**: Use to generate/store passwords
3. **2FA** (if enabled): Keep backup codes accessible
4. **Sign out**: Always sign out on shared computers

### Keyboard Workflow
```
Fast Login:
1. Focus username (auto-focus on page load)
2. Type username
3. Press Enter (moves to password)
4. Type password
5. Press Enter (submits form)
Total: 2 Enter presses, no Tab needed
```

---

## Known Issues & Roadmap

### Medium Priority

**Issue #4**: Password strength announcements
- **Status**: Planned for Sprint 2
- **Impact**: Screen reader users can't hear strength
- **Workaround**: Visual bars still shown
- **Fix**: Add aria-live region with strength text
- **ETA**: Sprint 2

**Issue #5**: Focus management on errors
- **Status**: Planned for Sprint 2
- **Impact**: Focus doesn't move to invalid fields
- **Workaround**: Tab through form to find errors
- **Fix**: Auto-focus first invalid field + aria-invalid
- **ETA**: Sprint 2

---

## Keyboard Navigation Testing

### Self-Test Checklist
Verify keyboard accessibility:

- [ ] **Login form**: Tab through all fields, Enter submits
- [ ] **Registration**: Complete signup with keyboard only
- [ ] **Forgot password**: Request reset via keyboard
- [ ] **Reset password**: Complete reset flow with keyboard
- [ ] **OAuth**: Activate Google Sign-In with Enter
- [ ] **View transitions**: Navigate between login/register
- [ ] **Focus visible**: Purple ring on all elements
- [ ] **Error handling**: Errors visible and readable
- [ ] **Password strength**: Visual bars update as you type

### Manual Testing Workflow
```
1. Disable mouse/trackpad
2. Navigate to /login
3. Tab through entire form
4. Verify focus indicators visible
5. Test Enter to submit
6. Test view transitions (forgot password, etc.)
7. Test OAuth button activation
8. Verify error messages on invalid login
9. Complete full login cycle with keyboard only
```

### Report Issues
Found a keyboard problem?
1. **Document**: Page, field, expected vs actual behavior
2. **Security note**: Mark auth issues as high priority
3. **Reproduce**: Provide steps to recreate
4. **Report**: GitHub Issues with "keyboard-navigation" + "auth" labels
5. **Template**: Use `.github/ISSUE_TEMPLATE/keyboard-accessibility.md`

---

## Project Integration

### Redirect URLs & Parameters
When auth is used by other apps:
- **project parameter**: Shows which app requested login
- **redirect_uri**: Where to return after auth
- **Keyboard flow**: Same keyboard navigation regardless of redirect
- **Token passing**: Secure, keyboard navigation unaffected

### Example Integration
```
App redirects to: /login?project=VideoVault&redirect_uri=https://app.example.com

Keyboard flow:
1. Tab through login form (project badge shows "VideoVault")
2. Enter credentials
3. Submit with Enter
4. Auto-redirect back to app with tokens
5. Seamless keyboard experience throughout
```

---

## Future Enhancements

### Planned Features
- **Remember device**: Checkbox with keyboard toggle
- **Biometric auth**: WebAuthn keyboard support
- **Social logins**: Additional OAuth providers
- **MFA**: Two-factor authentication with keyboard support
- **Account recovery**: Security questions with keyboard navigation

### Accessibility Roadmap
- **ARIA live regions**: Better screen reader support (Issue #4)
- **Focus management**: Auto-focus errors (Issue #5)
- **Keyboard hints**: Contextual shortcut help
- **Voice control**: Enhanced voice navigation support

---

## Getting Help

### Documentation
- **Full test guide**: `/shared-infrastructure/shared/design-system/KEYBOARD_NAVIGATION_TEST.md`
- **Issue tracker**: `/ACCESSIBILITY_ISSUES.md`
- **Security audit**: `/auth/SECURITY_AUDIT_REPORT.md`

### Support
- **Keyboard issues**: GitHub Issues with "keyboard-navigation" label
- **Security concerns**: Report via security@example.com (if configured)
- **Auth problems**: Include project and redirect info

### Resources
- [WebAIM Keyboard Guide](https://webaim.org/articles/keyboard/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [OAuth 2.0 Security](https://oauth.net/2/security-best-practices/)

---

**Last Updated**: 2026-01-10
**Version**: 1.0.0
**Design System**: Cybervault
**Security**: OAuth 2.0, HTTPS, JWT
**Accessibility**: WCAG 2.1 Level AA (in progress)
