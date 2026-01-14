# VideoVault Keyboard Shortcuts

Complete guide to keyboard navigation and shortcuts for efficient video library management.

---

## Universal Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Activate button, open video, submit form |
| `Space` | Activate button, toggle selection (coming soon) |
| `Esc` | Close modal, cancel action, exit fullscreen |

---

## Video Grid Navigation

### Browsing Your Library
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate through video cards in grid order (left→right, top→bottom) |
| `Enter` on video card | Open video player modal |
| `Enter` on thumbnail | Play video in modal |

### Grid Focus
- Focus moves in **reading order**: left to right, top to bottom
- **Focus indicator**: Cyan border appears on focused card
- **Hover effects**: Applied automatically when focused via keyboard
- **Large libraries**: Virtualized grids maintain focus when scrolling

### Search & Filters
| Shortcut | Action |
|----------|--------|
| `Tab` to search | Focus search input field |
| Type to search | Real-time filtering as you type |
| `Tab` to category | Focus category dropdown |
| `↑` `↓` in dropdown | Navigate category options |
| `Enter` in dropdown | Select category |

---

## Video Player Modal

### Basic Playback (Current)
| Shortcut | Action |
|----------|--------|
| `Esc` | Close video player and return to grid |
| `Tab` | Navigate player controls (Play, Volume, Fullscreen) |
| `Enter` on Play | Toggle play/pause |

### Enhanced Playback (Coming Soon - Issue #10)
These keyboard shortcuts will be added for power users:

| Shortcut | Action |
|----------|--------|
| `Space` | Toggle play/pause |
| `←` Left Arrow | Seek backward 5 seconds |
| `→` Right Arrow | Seek forward 5 seconds |
| `↑` Up Arrow | Increase volume 10% |
| `↓` Down Arrow | Decrease volume 10% |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `0-9` | Seek to 0%-90% of video |
| `?` | Show keyboard shortcuts help overlay |

### Player Controls
- **Play/Pause button**: Tab to reach, Enter to toggle
- **Volume slider**: Tab to reach, adjust with mouse or arrows (coming soon)
- **Progress bar**: Tab to reach, click to seek (keyboard seek coming soon)
- **Fullscreen**: Tab to reach, Enter to toggle, Esc to exit

---

## Bulk Selection & Operations

### Selection Mode (Coming Soon - Issue #11)

| Shortcut | Action |
|----------|--------|
| `Space` on video | Toggle selection checkbox |
| `Ctrl+A` | Select all videos |
| `Ctrl+Shift+A` | Deselect all videos |
| `Shift+Click` | Select range (requires mouse) |
| `Shift+↓/↑` | Extend selection (coming soon) |

### Bulk Actions Bar (When items selected)
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate bulk action buttons |
| `Enter` on Add Tags | Open tag assignment modal |
| `Enter` on Move | Open collection selector |
| `Enter` on Delete | Confirm bulk delete |
| `Esc` | Cancel selection and close bulk actions |

### Current Workaround
Until Space key selection is implemented (Issue #11):
1. Tab to video card
2. Tab to checkbox within card
3. Press Space to toggle checkbox
4. Repeat for additional selections

---

## Directory Scanner

### Scanning Controls
| Shortcut | Action |
|----------|--------|
| `Tab` to Scan button | Focus directory scan trigger |
| `Enter` | Open directory picker (browser permission required) |
| `Esc` during scan | Cancel ongoing scan operation |

### After Scanning
- **Tab** through discovered videos
- **Enter** to preview scanned videos
- **Tab** to Save button → **Enter** to persist to library

---

## Video Management

### Edit Video Metadata
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate form fields (Title, Category, Tags, etc.) |
| `Enter` in field | Begin editing |
| `Tab` to Save | Focus save button |
| `Enter` | Save changes |
| `Esc` | Cancel edit and close modal |

### Tag Management
- **Tab** to tag input
- **Type** to add new tag
- **Enter** to confirm tag
- **Tab** to tag chips → **Delete** to remove tag
- **Tab** through suggested tags → **Enter** to select

### Category Assignment
- **Tab** to category dropdown
- **↑↓** to navigate options (if native select)
- **Type** to filter categories (if autocomplete)
- **Enter** to select category

---

## Collections & Organization

### Collection Management
| Shortcut | Action |
|----------|--------|
| `Tab` through collections | Navigate collection list |
| `Enter` on collection | View collection videos |
| `Tab` to Add to Collection | Focus add button |
| `Enter` | Open collection selector modal |

### Creating Collections
- **Tab** to "New Collection" button
- **Enter** to open creation dialog
- **Type** collection name
- **Tab** to Create → **Enter** to save

---

## Settings & Preferences

### Navigation
| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate setting categories |
| `Enter` | Expand/collapse setting sections |
| `Space` | Toggle checkboxes |
| `↑↓` | Adjust number inputs (if applicable) |

### Form Submission
- **Tab** through all settings
- **Tab** to Save Settings button
- **Enter** to save all changes
- **Esc** to cancel without saving

---

## Accessibility Features

### Focus Indicators
All interactive elements show **cyan border** (2px) when focused:
- **Video cards**: Cyan border with glow effect
- **Buttons**: Cyan outline ring
- **Form inputs**: Border changes to cyan
- **Player controls**: Cyan highlight

### Reduced Motion
When system "Reduce motion" is enabled:
- **Card animations**: Instant state changes (no hover effects)
- **Transitions**: No fade or slide animations
- **Player**: Simplified playback controls
- **Grid**: Static layout, no animation on load

Enable in:
- **Windows**: Settings → Accessibility → Visual effects
- **macOS**: System Preferences → Accessibility → Display → Reduce motion
- **Linux**: Desktop environment settings

### High Contrast Mode
When system high contrast is enabled:
- **Borders**: Increase to 2px width
- **Focus indicators**: Higher contrast outline
- **Buttons**: Stronger border definition
- **Text**: Enhanced contrast ratios

---

## Tips for Power Users

### Efficient Library Management
1. **Search first**: Use search to narrow down before browsing
2. **Keyboard-only workflow**: Keep hands on keyboard for speed
3. **Tab navigation**: Faster than mouse for sequential tasks
4. **Bulk operations**: Select multiple → act once (when Space key works)

### Video Playback
1. **Space for play/pause** (coming soon): Most natural key
2. **Arrow keys for seeking** (coming soon): Quick navigation
3. **Number keys for chapters** (coming soon): Jump to specific points
4. **F for fullscreen**: Quick immersion mode

### Organization Strategy
1. **Tag while scanning**: Add tags immediately during import
2. **Keyboard tagging**: Faster than mouse clicking
3. **Category shortcuts**: Use dropdowns with arrow keys
4. **Collection workflow**: Tab → Enter → Select → Done

---

## Known Issues & Roadmap

### High Priority (Sprint 1)

**Issue #10**: Video player keyboard controls
- **Missing**: Space, arrow keys, M, F, 0-9 shortcuts
- **Impact**: Limited video playback navigation
- **Workaround**: Use mouse on player controls
- **ETA**: Sprint 1 (high priority)

**Issue #11**: Bulk selection with Space key
- **Missing**: Space to toggle video selection
- **Impact**: Must click checkboxes with mouse
- **Workaround**: Tab to checkbox → Space
- **ETA**: Sprint 1 (high priority)

### Medium Priority (Sprint 2)

**Issue #12**: Virtualized grid focus management
- **Problem**: Focus may be lost when scrolling large libraries
- **Impact**: Libraries with 1000+ videos
- **Workaround**: Re-focus card after scrolling
- **ETA**: Sprint 2

**Issue #14**: Bulk actions bar focus trap
- **Problem**: Tab may escape bulk actions bar
- **Impact**: Confusion when many items selected
- **Workaround**: Use Esc to cancel if focus lost
- **ETA**: Sprint 2

### Low Priority (Sprint 3)

**Issue #13**: Filter preset dropdown arrow navigation
- **Problem**: Custom dropdown may not support arrows
- **Workaround**: Use native browser select for now
- **ETA**: Sprint 3

---

## Keyboard Navigation Testing

### Self-Test Checklist
Try these scenarios to verify keyboard accessibility:

- [ ] **Grid Navigation**: Tab through 10+ videos, Enter to play
- [ ] **Search**: Tab to search, type query, see results update
- [ ] **Video Player**: Esc closes modal, returns to grid
- [ ] **Bulk Select**: Tab to video, Tab to checkbox, Space toggles
- [ ] **Edit Metadata**: Tab through form, Enter saves
- [ ] **Settings**: Navigate all options, save changes
- [ ] **Focus visible**: Cyan ring appears on every Tab press

### Report Problems
Found a keyboard navigation issue?
1. **Document**: Page, element, expected vs actual behavior
2. **Reproduce**: Steps to recreate the issue
3. **Report**: GitHub Issues with "keyboard-navigation" label
4. **Template**: Use `.github/ISSUE_TEMPLATE/keyboard-accessibility.md`

---

## Future Enhancements

### Planned Features
- **Smart focus restoration**: Remember last focused video
- **Keyboard-driven batch rename**: Tab through rename fields
- **Quick tag shortcuts**: Assign common tags with Ctrl+1-9
- **Collection quick switch**: Ctrl+Shift+1-9 for collections
- **Advanced search**: Ctrl+F for instant search focus
- **Filter quick toggle**: Ctrl+K for filter modal

### Community Requests
Vote on keyboard features you'd like to see:
- Video player chapter navigation
- Grid layout keyboard switching
- Thumbnail size adjustment via keyboard
- Keyboard-accessible color coding
- Quick duplicate finder shortcuts

---

## Getting Help

### Documentation
- **Full test guide**: `shared-infrastructure/shared/design-system/KEYBOARD_NAVIGATION_TEST.md`
- **Issue tracker**: `ACCESSIBILITY_ISSUES.md`
- **Design system**: `shared-infrastructure/shared/design-system/cybervault.css`

### Support Channels
- **GitHub Issues**: Report bugs with keyboard navigation
- **Discussions**: Share keyboard workflow tips
- **Pull Requests**: Contribute keyboard shortcuts

### Resources
- [WebAIM Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [W3C Media Player Accessibility](https://www.w3.org/WAI/perspective-videos/keyboard/)
- [ARIA Video Player Practices](https://www.w3.org/WAI/ARIA/apg/patterns/media-player/)

---

**Last Updated**: 2026-01-10
**Version**: 1.0.0
**Design System**: Cybervault
**Accessibility**: WCAG 2.1 Level AA (in progress)
