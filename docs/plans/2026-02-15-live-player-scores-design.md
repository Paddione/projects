# Live Player Score Updates Design

**Date**: 2026-02-15
**Status**: Approved

## Problem

1. Player plates vanish entirely on desktop after picking an answer, reappearing only when the next question starts
2. Only the top 2 opponents are visible in the right pane (`.slice(0, 2)` limit)
3. Users want to see all players' scores update live with visual flash feedback when others answer

## Solution

Three changes, no new components or backend modifications needed.

### 1. Show All Players (not just top 2)

Remove the `.slice(0, 2)` filter in `GamePage.tsx` and set `maxPlayers` dynamically to match the actual player count. Apply the same change to the mobile stats bar.

### 2. Fix Disappearing Plates

Investigate and fix the root cause of plates vanishing after answering on desktop. The right pane JSX has no `hasAnswered` guard, so the cause is likely a rendering edge case during the 5-second gap between `question-ended` and `question-started` events. Add defensive checks to ensure the players array is never replaced with empty data.

### 3. Leverage Existing Glow Animations

The `slotGlowCorrect` / `slotGlowWrong` CSS animations in `PlayerGrid.module.css` already flash plates green/red for 900ms via `playerAnswerStatus`. Making all plates visible is sufficient -- no animation changes needed.

## Files Changed

| File | Change |
|------|--------|
| `l2p/frontend/src/pages/GamePage.tsx` | Remove `.slice(0, 2)`, dynamic `maxPlayers`, fix disappearing |
| `l2p/frontend/src/styles/GamePage.module.css` | Adjust right pane layout for variable player count |

## What Does NOT Change

- No backend changes
- No new socket events
- No new components
- PlayerGrid, ScoreDisplay, and gameStore unchanged
- Glow animations already implemented
