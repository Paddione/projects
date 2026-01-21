# L2P Keyboard Shortcuts

Complete guide to keyboard navigation and shortcuts in the L2P quiz platform.

---

## Universal Shortcuts

These shortcuts work throughout the application:

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Activate focused button or link |
| `Space` | Activate focused button or checkbox |
| `Esc` | Close modals, cancel actions, return to previous screen |

---

## Home Page

### Navigation
- `Tab` → Skip to main content (first press shows skip link)
- `Tab` → Navigate through Create Lobby, Join Lobby, Login buttons
- `Enter` or `Space` → Activate focused button

### Quick Actions
- Focus "Create Lobby" → `Enter` → Create new game lobby
- Focus "Join Lobby" → `Enter` → Enter lobby code input
- Focus Login → `Enter` → Navigate to login page

---

## Lobby Page

### Lobby Management
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate lobby controls (Copy Code, Start Game, Leave) |
| `Enter` on Copy Code | Copy lobby code to clipboard |
| `Enter` on Start Game | Begin the quiz (when 2+ players) |
| `Enter` on Leave Lobby | Return to home page |

### Host Controls
- **Start Game** (Host only): `Tab` to button → `Enter` to start
  - Disabled until minimum players joined
  - Visual feedback shows when ready

### Player Actions
- Tab through player list to view participants
- Focus on player card → `Enter` for actions (if host)

---

## Game Page - Answer Selection

### Primary Controls (Current Implementation)
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between answer options (A, B, C, D) |
| `Enter` | Select focused answer |
| `Space` | Select focused answer |

### Enhanced Controls (Coming Soon - Issue #6)
These keyboard shortcuts will be added in a future update:

| Shortcut | Action |
|----------|--------|
| `↑` `↓` | Navigate between answers (vertical layout) |
| `←` `→` | Navigate between answers (horizontal layout) |
| `1` | Select Answer A |
| `2` | Select Answer B |
| `3` | Select Answer C |
| `4` | Select Answer D |

### During Gameplay
- **Timer active**: Timer display is non-focusable, won't interrupt navigation
- **After selection**: Visual feedback shows selected answer
- **Correct/Incorrect**: Animated feedback with color-coded borders
  - Green glow = Correct answer
  - Red glow = Incorrect answer

### Tips
- Select quickly! The timer is always running
- You can change your answer before time runs out
- Visual focus ring shows which answer is currently selected

---

## Question Set Manager (Admin)

### Modal Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate form fields in modal |
| `Esc` | Close modal and return to manager |
| `Enter` on Save | Submit question changes |

### Focus Management (Coming Soon - Issue #8)
Enhanced modal focus trapping will be added:
- Focus stays within modal when open
- Tab cycles through modal elements only
- Shift+Tab navigates backwards within modal
- Focus returns to trigger button on close

---

## Results Page

### Post-Game Actions
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate through scores and action buttons |
| `Enter` on Play Again | Start new game with same settings |
| `Enter` on Return to Lobby | Go back to lobby |
| `Enter` on Go Home | Return to home page |

---

## Profile & Settings

### Form Navigation
- `Tab` → Navigate through settings fields
- `Enter` on Save → Submit changes
- `Esc` → Cancel and return without saving

### Avatar & Badges
- Tab through customization options
- `Enter` to select avatar or badge
- Visual preview updates as you navigate

---

## Admin Panel

### Navigation
- `Tab` through admin controls
- `Enter` on sections to expand/collapse
- `Esc` to close admin overlays

### Management Actions
- Focus on user → `Enter` for user details
- Focus on question set → `Enter` to edit
- Focus on Delete → `Enter` (with confirmation)

---

## Accessibility Features

### Focus Indicators
All interactive elements have a visible **cyan focus ring** (2px outline) when focused via keyboard:
- Buttons: Cyan glow around button
- Form inputs: Purple border changes to cyan
- Answer options: Cyan border highlight
- Links: Underline appears on focus

### Reduced Motion
If you have "Reduce motion" enabled in your system preferences:
- Animations are minimized
- Transitions are instant
- Game effects are simplified
- Focus changes are immediate

To enable:
- **Windows**: Settings → Accessibility → Visual effects → Animation effects (off)
- **macOS**: System Preferences → Accessibility → Display → Reduce motion
- **Linux**: Varies by desktop environment

### Screen Reader Support
The application includes ARIA labels and live regions for screen reader users:
- Form field descriptions
- Error announcements
- Timer countdowns
- Score updates
- Game state changes

---

## Form Validation

### Error Handling
When a form has errors:
1. Error message appears above form
2. Invalid fields are highlighted
3. Focus moves to first error (Coming Soon - Issue #5)
4. Press `Tab` to navigate to next field

### Login & Registration
- `Tab` through username → email → password
- `Enter` in any field submits form
- Error messages appear inline
- Focus indicators show current field

---

## Tips for Efficient Keyboard Use

### General Navigation
1. **Use Tab liberally**: All interactive elements are keyboard accessible
2. **Look for focus indicators**: The cyan ring shows where you are
3. **Enter vs Space**: Both work on buttons, use whichever you prefer
4. **Esc is your friend**: Closes modals and cancels actions

### During Gameplay
1. **Tab to first answer**: Gets you into the answer area quickly
2. **Arrow keys** (coming soon): Will make answer selection faster
3. **Number keys** (coming soon): Will allow instant answer selection
4. **Stay focused**: Keep an eye on the timer!

### For Power Users
- **Tab + Enter combo**: Fastest way to navigate and activate
- **Shift+Tab**: Quick way to go back without using mouse
- **Esc**: Instant cancel without looking for close button
- **Keyboard-first workflow**: Hands stay on keyboard, faster gameplay

---

## Keyboard Navigation Testing

### How to Test
1. **Disable your mouse/trackpad** (optional but recommended)
2. **Start at home page**
3. **Press Tab** to move through elements
4. **Press Enter/Space** to activate
5. **Verify focus indicators** are visible at each step

### What to Look For
- [ ] All buttons reachable with Tab
- [ ] Focus ring clearly visible
- [ ] Enter and Space both work on buttons
- [ ] Forms submittable with keyboard
- [ ] Modals closeable with Esc
- [ ] No keyboard traps (focus can always move)

### Report Issues
If you find keyboard navigation problems:
1. Note the page and element
2. Describe what you expected vs what happened
3. Report via GitHub Issues using "Keyboard Accessibility" template

---

## Known Issues & Upcoming Features

### In Development (See ACCESSIBILITY_ISSUES.md)

**Issue #6**: Arrow key answer navigation
- **Status**: Planned
- **Impact**: Will make answer selection faster
- **ETA**: Sprint 1

**Issue #7**: Player list keyboard navigation
- **Status**: Planned
- **Impact**: Host can manage players via keyboard
- **ETA**: Sprint 2

**Issue #8**: Modal focus trap
- **Status**: Planned
- **Impact**: Better modal keyboard experience
- **ETA**: Sprint 1

**Issue #9**: Timer focus management
- **Status**: Low priority
- **Impact**: Minor, timer updates won't steal focus
- **ETA**: Sprint 3

### Completed Features
✓ Tab navigation through all elements
✓ Enter/Space activation on buttons
✓ Visible focus indicators (cyan ring)
✓ Form keyboard submission
✓ Reduced motion support
✓ High contrast mode support

---

## Getting Help

### Keyboard Navigation Support
- **Documentation**: See `shared-infrastructure/shared/design-system/KEYBOARD_NAVIGATION_TEST.md`
- **GitHub Issues**: Report problems with "keyboard-navigation" label
- **Testing Guide**: `KEYBOARD_NAVIGATION_TEST.md`

### Accessibility Resources
- [WebAIM Keyboard Guide](https://webaim.org/articles/keyboard/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Practices Guide](https://www.w3.org/WAI/ARIA/apg/)

---

**Last Updated**: 2026-01-10
**Version**: 1.0.0
**Design System**: Cybervault
