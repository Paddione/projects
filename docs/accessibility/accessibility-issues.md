# Keyboard Accessibility Issues - Cybervault Design System

This document tracks all keyboard navigation and accessibility issues identified during testing. Each issue includes severity, affected components, and implementation recommendations.

**Generated from**: KEYBOARD_TEST_RESULTS.md
**Date**: 2026-01-10

---

## High Priority Issues

### Issue #3: Stripe Payment Form Keyboard Accessibility
**Application**: Payment
**Component**: `payment/app/wallet/add-funds-form.tsx`
**Severity**: HIGH
**WCAG Criteria**: 2.1.1 Keyboard (Level A)

**Description**: Stripe Elements iframe keyboard accessibility not verified.

**Current Behavior**: Integration with Stripe payment form exists but keyboard navigation through payment fields not tested.

**Expected Behavior**:
- Tab should navigate through credit card number, expiry, CVC fields
- All Stripe Elements should be fully keyboard accessible
- Focus indicators should be visible on all payment fields

**Reproduction Steps**:
1. Navigate to /wallet
2. Click "Add Funds"
3. Attempt to navigate Stripe payment form with keyboard only
4. Verify all fields accessible

**Recommended Fix**:
```tsx
// Ensure Stripe Elements configuration includes accessibility
const stripeElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#f0f0f3',
      '::placeholder': {
        color: '#6e6e73'
      }
    }
  }
}

// Add focus event handlers
cardElement.on('focus', () => {
  // Apply focus styling
})
```

**Action Items**:
- [ ] Test Stripe Elements with keyboard-only navigation
- [ ] Verify focus indicators visible in dark theme
- [ ] Add automated test for payment form keyboard flow
- [ ] Document any Stripe-specific keyboard shortcuts

**Labels**: `accessibility`, `keyboard-navigation`, `payment`, `high-priority`

---

### Issue #6: Game Answer Options Missing Keyboard Shortcuts
**Application**: L2P
**Component**: `l2p/frontend/src/components/GameView.tsx`
**Severity**: HIGH
**WCAG Criteria**: 2.1.1 Keyboard (Level A)

**Description**: Quiz answer selection only works with Tab+Enter, missing arrow key and number key shortcuts.

**Current Behavior**:
- User must Tab through each answer option
- Enter key selects answer
- No arrow key navigation
- No number key shortcuts (1/2/3/4)

**Expected Behavior**:
- Tab focuses answer group
- Arrow keys (Up/Down or Left/Right) navigate between answers
- Number keys 1-4 directly select answers
- Space or Enter confirms selection
- Visual focus follows keyboard navigation

**Reproduction Steps**:
1. Start a game
2. Press Tab to focus first answer
3. Press Down Arrow - nothing happens (should move to next answer)
4. Press "2" key - nothing happens (should select answer B)

**Recommended Fix**:
```tsx
// In GameView or AnswerOptions component
const handleKeyDown = (e: KeyboardEvent) => {
  switch(e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault();
      focusNextAnswer();
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault();
      focusPreviousAnswer();
      break;
    case '1':
      selectAnswer(0);
      break;
    case '2':
      selectAnswer(1);
      break;
    case '3':
      selectAnswer(2);
      break;
    case '4':
      selectAnswer(3);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      confirmSelection();
      break;
  }
}

// Add to answer container
<div
  className="answer-options-grid"
  onKeyDown={handleKeyDown}
  role="radiogroup"
  aria-label="Answer options"
>
  {/* answers */}
</div>
```

**Action Items**:
- [ ] Implement arrow key navigation
- [ ] Add number key shortcuts (1-4)
- [ ] Update answer-option components with proper ARIA roles
- [ ] Add visual indicator for keyboard-focused answer
- [ ] Write Playwright test for keyboard answer selection
- [ ] Document shortcuts in game UI help

**Labels**: `accessibility`, `keyboard-navigation`, `l2p`, `game`, `high-priority`

---

### Issue #8: Question Set Manager Modal Focus Trap
**Application**: L2P
**Component**: `l2p/frontend/src/pages/QuestionSetManagerPage.tsx`
**Severity**: HIGH
**WCAG Criteria**: 2.1.2 No Keyboard Trap (Level A)

**Description**: Modal focus trap not implemented - Tab key may escape modal to background content.

**Current Behavior**:
- Modal opens but focus can escape to background
- Esc key behavior not verified
- Focus doesn't return to trigger element on close

**Expected Behavior**:
- Focus trapped within modal when open
- Tab cycles through modal elements only
- Shift+Tab cycles backwards
- Esc key closes modal
- Focus returns to element that opened modal

**Reproduction Steps**:
1. Open Question Set Manager
2. Press Tab repeatedly
3. Observe if focus escapes modal to background content

**Recommended Fix**:

Option 1 - Use React Focus Trap library:
```tsx
import FocusTrap from 'focus-trap-react';

function QuestionSetModal({ isOpen, onClose }) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <FocusTrap active={isOpen}>
      <div className="modal" role="dialog" aria-modal="true">
        <button
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>
        {/* modal content */}
      </div>
    </FocusTrap>
  );
}
```

Option 2 - Custom hook:
```tsx
function useFocusTrap(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return;

    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);
}
```

**Action Items**:
- [ ] Install focus-trap-react or implement custom hook
- [ ] Apply to all modal components
- [ ] Implement Esc key close handler
- [ ] Store and restore focus on modal close
- [ ] Add aria-modal="true" to modal containers
- [ ] Test with screen reader
- [ ] Write Playwright test for focus trap

**Labels**: `accessibility`, `keyboard-navigation`, `l2p`, `modal`, `high-priority`

---

### Issue #10: Video Player Modal Missing Keyboard Controls
**Application**: VideoVault
**Component**: Video player modal
**Severity**: HIGH
**WCAG Criteria**: 2.1.1 Keyboard (Level A)

**Description**: Custom video player keyboard shortcuts not implemented.

**Current Behavior**:
- Native browser video controls only
- No custom keyboard shortcuts
- Limited keyboard interaction

**Expected Behavior**:
- **Space**: Play/Pause
- **Left Arrow**: Seek backward 5 seconds
- **Right Arrow**: Seek forward 5 seconds
- **Up Arrow**: Increase volume 10%
- **Down Arrow**: Decrease volume 10%
- **F**: Toggle fullscreen
- **M**: Mute/unmute
- **Esc**: Close player modal
- **0-9**: Seek to 0%-90% of video

**Reproduction Steps**:
1. Open video player
2. Press Space - may not toggle play/pause
3. Press arrow keys - may not seek
4. Press F - may not fullscreen

**Recommended Fix**:
```tsx
function VideoPlayer({ videoRef, onClose }) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch(e.key) {
        case ' ':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen(video);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          // Handle 0-9 for seek percentages
          if (e.key >= '0' && e.key <= '9') {
            const percent = parseInt(e.key) / 10;
            video.currentTime = video.duration * percent;
          }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [videoRef, onClose]);

  return (
    <div className="video-player-modal">
      {/* Add keyboard shortcuts help overlay */}
      <div className="keyboard-shortcuts-help" aria-label="Keyboard shortcuts">
        <kbd>Space</kbd> Play/Pause
        <kbd>←/→</kbd> Seek
        <kbd>F</kbd> Fullscreen
        {/* ... */}
      </div>
      <video ref={videoRef} />
    </div>
  );
}
```

**Action Items**:
- [ ] Implement keyboard event handlers
- [ ] Add visual feedback for keyboard actions
- [ ] Create keyboard shortcuts help overlay (toggle with ?)
- [ ] Test fullscreen keyboard interaction
- [ ] Write Playwright test for player controls
- [ ] Document shortcuts in help page

**Labels**: `accessibility`, `keyboard-navigation`, `videovault`, `player`, `high-priority`

---

### Issue #11: Bulk Selection Not Keyboard Accessible
**Application**: VideoVault
**Component**: Video grid with bulk selection
**Severity**: HIGH
**WCAG Criteria**: 2.1.1 Keyboard (Level A)

**Description**: Bulk selection mode requires mouse clicks - Space key doesn't toggle selection.

**Current Behavior**:
- Must click checkboxes with mouse to select videos
- No keyboard method to toggle selection
- Bulk actions bar appears but selection is mouse-only

**Expected Behavior**:
- Tab navigates to video cards
- Space key toggles selection on focused card
- Ctrl+A selects all videos
- Shift+Arrow extends selection range
- Bulk actions bar keyboard accessible when items selected

**Reproduction Steps**:
1. Navigate to video grid
2. Tab to first video card
3. Press Space - checkbox should toggle
4. Currently: nothing happens

**Recommended Fix**:
```tsx
function VideoCard({ video, isSelected, onToggleSelect }) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      onToggleSelect(video.id);
    }
  };

  return (
    <div
      className="video-card"
      tabIndex={0}
      role="checkbox"
      aria-checked={isSelected}
      onClick={() => onToggleSelect(video.id)}
      onKeyDown={handleKeyDown}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(video.id)}
        tabIndex={-1} // Card itself is focusable, not checkbox
        aria-hidden="true"
      />
      {/* card content */}
    </div>
  );
}

// In grid component
function VideoGrid() {
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Ctrl+A to select all
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      selectAllVideos();
    }
  };

  return (
    <div onKeyDown={handleGlobalKeyDown}>
      {/* video cards */}
    </div>
  );
}
```

**Action Items**:
- [ ] Add Space key handler to video cards
- [ ] Implement Ctrl+A select all
- [ ] Add Shift+Arrow for range selection
- [ ] Update ARIA roles for selection mode
- [ ] Ensure bulk actions bar receives focus
- [ ] Write Playwright test for bulk selection
- [ ] Document shortcuts in UI

**Labels**: `accessibility`, `keyboard-navigation`, `videovault`, `bulk-operations`, `high-priority`

---

## Medium Priority Issues

### Issue #1: Admin Dropdown Keyboard Navigation
**Application**: Payment
**Component**: `payment/components/header.tsx`
**Severity**: MEDIUM

**Description**: Admin menu potentially missing keyboard support if implemented as dropdown.

**Recommended Fix**: If admin section has dropdown menu, implement arrow key navigation or use native select element.

**Action Items**:
- [ ] Verify admin menu structure
- [ ] Add keyboard navigation if dropdown
- [ ] Test with keyboard only

---

### Issue #4: Password Strength Not Announced
**Application**: Auth
**Component**: Login and Register pages
**Severity**: MEDIUM
**WCAG Criteria**: 4.1.3 Status Messages (Level AA)

**Description**: Password strength indicator visual only - not announced to screen readers.

**Recommended Fix**:
```tsx
<div className="auth-password-strength">
  <div className="auth-strength-bar weak active" />
  <div className="auth-strength-bar" />
  <div className="auth-strength-bar" />
  <div className="auth-strength-bar" />
  <span
    className="sr-only"
    aria-live="polite"
    aria-atomic="true"
  >
    Password strength: {strength}
  </span>
</div>
```

**Action Items**:
- [ ] Add aria-live region for password strength
- [ ] Announce strength level changes
- [ ] Test with screen reader

---

### Issue #5: Focus Management on Form Errors
**Application**: Auth (all apps)
**Component**: All form pages
**Severity**: MEDIUM
**WCAG Criteria**: 3.3.1 Error Identification (Level A)

**Description**: When form submission fails, focus remains on submit button instead of moving to first error.

**Recommended Fix**:
```tsx
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    await submitForm();
  } catch (error) {
    setError(error.message);

    // Focus first invalid field
    const firstInvalid = document.querySelector('[aria-invalid="true"]');
    if (firstInvalid) {
      firstInvalid.focus();
    }
  }
};

// Add aria-invalid to invalid fields
<input
  className="auth-input"
  aria-invalid={!!emailError}
  aria-describedby={emailError ? 'email-error' : undefined}
/>
{emailError && (
  <span id="email-error" className="auth-error">
    {emailError}
  </span>
)}
```

**Action Items**:
- [ ] Add error focus management to all forms
- [ ] Use aria-invalid and aria-describedby
- [ ] Test error announcement with screen reader

---

### Issue #7: Player List Not Keyboard Navigable
**Application**: L2P
**Component**: Lobby player list
**Severity**: MEDIUM

**Description**: Player list items not focusable for context actions.

**Recommended Fix**:
```tsx
<div className="player-card" tabIndex={0} role="button">
  {/* player info */}
</div>
```

**Action Items**:
- [ ] Add tabindex to player items
- [ ] Implement context menu keyboard access
- [ ] Add ARIA labels

---

### Issue #12: Virtualized Grid Focus Management
**Application**: VideoVault
**Component**: Video grid with react-window
**Severity**: MEDIUM

**Description**: Focus may be lost when virtualized items unmount during scroll.

**Recommended Fix**: Use react-window's `onItemsRendered` callback to restore focus to nearest visible item.

**Action Items**:
- [ ] Implement focus restoration logic
- [ ] Test with large libraries (1000+ videos)
- [ ] Add automated test

---

### Issue #14: Bulk Actions Bar Focus Trap
**Application**: VideoVault
**Component**: Fixed bulk actions bar
**Severity**: MEDIUM

**Description**: Focus may escape bulk actions bar to background content.

**Recommended Fix**: Implement focus trap when bulk actions active, similar to modal focus trap.

**Action Items**:
- [ ] Add focus trap to bulk actions bar
- [ ] Esc key cancels and restores focus
- [ ] Test keyboard-only bulk operations

---

### Issue #15: Modal Close Button Accessible Labels
**Application**: All
**Component**: All modals
**Severity**: MEDIUM
**WCAG Criteria**: 4.1.2 Name, Role, Value (Level A)

**Description**: Close buttons (X) lack accessible text labels.

**Recommended Fix**:
```tsx
<button
  className="modal-close"
  aria-label="Close modal"
  onClick={onClose}
>
  <span aria-hidden="true">×</span>
</button>
```

**Action Items**:
- [ ] Add aria-label to all close buttons
- [ ] Search codebase for "×" and "✕" characters
- [ ] Update modal components

---

## Low Priority Issues

### Issue #2: Product Images Not Skippable
**Application**: Payment
**Severity**: LOW

**Recommended Fix**: Add `aria-hidden="true"` to decorative product images.

---

### Issue #9: Game Timer Focus Issues
**Application**: L2P
**Severity**: LOW

**Recommended Fix**: Ensure timer updates don't steal focus. Use aria-live for announcements.

---

### Issue #13: Filter Preset Arrow Navigation
**Application**: VideoVault
**Severity**: LOW

**Recommended Fix**: Use native `<select>` for automatic arrow key support.

---

### Issue #16: Loading State Announcements
**Application**: All
**Severity**: LOW

**Recommended Fix**:
```tsx
<div className="loading-spinner" role="status">
  <span className="sr-only">Loading...</span>
  <div aria-hidden="true" className="spinner" />
</div>
```

---

## Implementation Roadmap

### Sprint 1 (Week 1-2): Critical Issues
- Issue #3: Stripe keyboard accessibility
- Issue #6: Game answer keyboard shortcuts
- Issue #8: Modal focus traps
- Issue #10: Video player controls
- Issue #11: Bulk selection keyboard support

### Sprint 2 (Week 3-4): Medium Priority
- Issue #4: Password strength announcements
- Issue #5: Form error focus management
- Issue #7: Player list keyboard navigation
- Issue #12: Virtualized grid focus
- Issue #14: Bulk actions focus trap
- Issue #15: Modal close button labels

### Sprint 3 (Week 5): Low Priority & Polish
- Issue #2: Decorative image cleanup
- Issue #9: Timer focus management
- Issue #13: Dropdown arrow navigation
- Issue #16: Loading state announcements

---

## Testing Checklist

After implementing fixes:

- [ ] Manual keyboard testing on all apps
- [ ] Screen reader testing (NVDA/JAWS/VoiceOver)
- [ ] Automated Playwright keyboard tests
- [ ] Browser zoom testing (200%)
- [ ] High contrast mode testing
- [ ] Reduced motion testing
- [ ] Mobile touch keyboard testing
- [ ] Document all keyboard shortcuts

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [Focus Trap React](https://github.com/focus-trap/focus-trap-react)

---

**Document Status**: Active Development
**Last Updated**: 2026-01-10
**Next Review**: After Sprint 1 completion
