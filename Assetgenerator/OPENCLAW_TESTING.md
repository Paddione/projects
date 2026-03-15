# Assetgenerator — Functional Testing Guide

This guide covers all testable features of the Assetgenerator web app.
Access it at **http://\<host\>:5200** (or the deployed URL).

---

## 1. Navigation & Views

### 1.1 Project Selector
- [ ] Top-left dropdown lists all projects (e.g., "arena")
- [ ] Selecting a project loads its sounds and visual assets
- [ ] Project name appears in the header

### 1.2 View Tabs
- [ ] **Audio** tab shows project sounds and global library
- [ ] **Visual** tab shows visual asset pipeline (if configured)
- [ ] Switching tabs preserves the selected project

---

## 2. Project Audio (Top Section)

### 2.1 Sound Cards
- [ ] Each project sound shows: name, type badge (sfx/music), duration, file size
- [ ] Waveform visualization renders (cyan gradient on dark background)
- [ ] Clicking the waveform or play button ▶ plays the audio
- [ ] Clicking again stops playback
- [ ] Only one sound plays at a time (previous stops)

### 2.2 Editing Sound Settings
- [ ] **Prompt** textarea is editable — change the generation text
- [ ] **Duration** number input — change target length (seconds)
- [ ] **Seed** number input — set a specific seed or leave blank for "auto"
- [ ] **Backend** dropdown — choose generation backend (e.g., audiocraft)
- [ ] Click **Save** — card flashes briefly confirming save
- [ ] Reload page — verify saved values persist

### 2.3 Flagging for Regeneration
- [ ] Click **Flag for Regen** button — card highlights orange, button turns "Unflag"
- [ ] Click again — unflag, card returns to normal
- [ ] Flag is preserved after Save

### 2.4 Bulk Regeneration (Project)
- [ ] Flag one or more sounds
- [ ] Click **Regenerate Flagged** button in the header
- [ ] Log panel appears at bottom with scrolling event log
- [ ] Progress events show: `[1/N] generating <name> via audiocraft`
- [ ] Done events show: `[1/N] ✓ <name> (seed: <n>, <dur>s)`
- [ ] Error events show: `[1/N] ✗ <name>: <error message>`
- [ ] Completion summary: `Complete: N ok, M failed`
- [ ] After completion, waveforms refresh with new audio
- [ ] Flagged state clears on successfully regenerated sounds
- [ ] Button re-enables after completion

---

## 3. Global Library (Bottom Section)

### 3.1 Library Cards
- [ ] Each library sound shows: name, category badge, project assignment badges
- [ ] Waveform visualization renders correctly
- [ ] Play button works — plays WAV from NAS library
- [ ] Category badge shows full path (e.g., "sfx/weapons")
- [ ] Project badges show which projects use this sound (e.g., "arena")

### 3.2 Editing Library Sound Settings
- [ ] **Prompt** textarea — edit the generation prompt
- [ ] **Duration** input — change target duration
- [ ] **Seed** input — set seed or leave blank for random
- [ ] Click **Save** — card flashes confirming save
- [ ] Assignment info shows: `Assigned: arena/sfx/gunshot (synced 2h ago)`

### 3.3 Regenerate Button (per-item)
- [ ] Each library card has a **Regen** button (cyan/primary style)
- [ ] Click **Regen** — button text changes to "Generating…"
- [ ] Card border highlights cyan during generation
- [ ] Any edited prompt/duration/seed is saved before generation starts
- [ ] Button text changes to "Processing…" during audio conversion (WAV→OGG+MP3)
- [ ] On success: waveform refreshes with new audio, card flashes, seed updates
- [ ] On error: button shows "Failed" briefly with orange border, then resets
- [ ] If another generation is running: button shows "Busy" for 2 seconds
- [ ] After completion: button re-enables as "Regen"
- [ ] Play the sound after regen — verify it matches the new prompt/settings

### 3.4 Regenerate Workflow Test
- [ ] Edit a sound's prompt to something distinctly different
- [ ] Clear the seed field (leave blank for random)
- [ ] Click **Regen**
- [ ] After completion: seed field shows the new seed value
- [ ] Play the audio — verify it sounds different from before
- [ ] Set a specific seed, click **Regen** again
- [ ] Verify the same seed produces consistent output

### 3.5 Delete Library Sound
- [ ] Click **Del** button — confirmation dialog appears
- [ ] Confirm — sound removed from library, card disappears
- [ ] Cancel — nothing happens

### 3.6 Create New Library Sound
- [ ] Use the "Add to Library" form (if present)
- [ ] Fill in: ID, name, category, prompt, duration
- [ ] Submit — new card appears in the library
- [ ] Click **Regen** on the new card to generate audio

---

## 4. Library ↔ Project Integration

### 4.1 Assigning Library Sounds to Projects
- [ ] In project view, sound slots show a dropdown of library sounds
- [ ] Select a library sound from the dropdown → assignment is saved
- [ ] Library card updates to show the project badge
- [ ] Slot shows "synced" badge (green) after sync

### 4.2 Syncing
- [ ] Click project **Sync** button (if present)
- [ ] Library sounds are copied to the project's audio directory
- [ ] Slot badges update from "stale" (orange) to "synced" (green)

### 4.3 Importing Project Sounds to Library
- [ ] Use the import feature to bring project sounds into the global library
- [ ] Verify imported sounds appear with correct metadata

---

## 5. Audio Playback

### 5.1 Web Audio Controls
- [ ] Play button toggles between ▶ (play) and ⏹ (stop)
- [ ] Audio plays through browser (Web Audio API)
- [ ] Playing one sound stops any currently playing sound
- [ ] Works for both project sounds and library sounds

### 5.2 Waveform Display
- [ ] Waveform shows cyan gradient bars on dark background
- [ ] "No audio" state shows gray placeholder text
- [ ] "Loading..." shows while fetching audio data
- [ ] Waveform updates after regeneration

---

## 6. Error Handling

### 6.1 Network Errors
- [ ] Disconnect from server → actions show appropriate error states
- [ ] Reconnect → refresh page, verify state is intact

### 6.2 Concurrent Generation
- [ ] Start a regeneration (project or library)
- [ ] Try to start another — should get "Busy" / 409 response
- [ ] First generation completes normally

### 6.3 Missing Audio Files
- [ ] If a sound has no WAV file yet, waveform shows "No audio"
- [ ] Clicking **Regen** generates the file from scratch

---

## 7. Quick Smoke Test Checklist

For a fast verification that everything works:

1. [ ] Open the app — page loads without errors
2. [ ] Select "arena" project — sound cards appear
3. [ ] Play any project sound — audio plays
4. [ ] Switch to library section — library cards appear
5. [ ] Play any library sound — audio plays
6. [ ] Edit a library sound's prompt, click **Save** — flash confirms
7. [ ] Click **Regen** on a library sound — generation runs, waveform updates
8. [ ] Flag a project sound, click **Regenerate Flagged** — log panel shows progress
9. [ ] Verify no console errors (F12 → Console)

---

## Environment Notes

- **Backend**: AudioCraft via Python venv (requires CUDA GPU for generation)
- **Audio Storage**: WAV master files on NAS, OGG+MP3 generated alongside
- **Browser**: Any modern browser (Chrome, Firefox, Edge)
- **Port**: 5200 (default)
