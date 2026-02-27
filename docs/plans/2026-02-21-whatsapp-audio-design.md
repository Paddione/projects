# WhatsApp Audio Message Support — Design

**Date**: 2026-02-21
**Scope**: OpenClaw — Approach A (Minimal)
**Goal**: Accept WhatsApp voice notes (transcribe to text) and output voice when the user explicitly asks.

## Context

OpenClaw already has:
- WhatsApp channel via Baileys (`extensions/whatsapp/`, `src/web/`)
- Audio transcription providers (Whisper CLI, Sherpa-ONNX, Deepgram, etc.)
- TTS providers (OpenAI, ElevenLabs, Edge, Sherpa-ONNX)
- A `tts` agent tool that the AI calls on user request
- Media pipeline (`src/media-understanding/`) for attachment processing

**Two gaps** prevent full WhatsApp audio support:

1. **Inbound (groups)**: Voice notes are silently dropped by mention gating before transcription
2. **Outbound**: TTS audio may not render as a WhatsApp voice bubble (PTT flag not set)

## Part 1: Inbound — Audio Preflight Transcription

### Problem

WhatsApp group channels with `requireMention: true` check the message text for bot mentions. Voice-only messages have body `<media:audio>` which never matches. The audio is downloaded but not transcribed before the gating decision.

Telegram already solved this in `src/telegram/bot-message-context.ts:407-450` with `transcribeFirstAudio()`.

### Solution

Mirror the Telegram pattern in WhatsApp's group gating:

**File**: `src/web/auto-reply/monitor/group-gating.ts`

**Logic**:
1. After building the inbound message but before mention gating, detect: is this an audio-only group message where `requireMention` is active?
2. If yes, call `transcribeFirstAudio()` from `src/media-understanding/audio-preflight.ts`
3. Pass the transcript to `matchesMentionWithExplicit()` (or equivalent) alongside the original text
4. If transcript contains a mention → allow through; otherwise → drop as before

**STT provider**: Local Whisper CLI (user preference). Already configured in media-understanding pipeline.

**DMs**: No change — DMs bypass mention gating. Audio flows to agent, transcribed during processing.

### Inputs/Outputs

- **Input**: `WebInboundMsg` with `mediaPath` (audio file path), `mediaType` ("audio/ogg"), `body` ("<media:audio>")
- **Processing**: `transcribeFirstAudio({ ctx, cfg, agentDir })` → transcript string
- **Output**: Transcript passed to mention matcher; message allowed or dropped

## Part 2: Outbound — Voice Bubble (PTT) for TTS Output

### Problem

The agent's `tts` tool (`src/agents/tools/tts-tool.ts`) returns `MEDIA:<audio_path>`. WhatsApp's `sendMessageWhatsApp()` (`src/web/outbound.ts`) already handles audio files and sets Opus codec. However, the `ptt: true` flag (Push-to-Talk, renders as voice bubble) may not be set, causing audio to appear as a file attachment instead of a playable voice note.

### Solution

Verify and ensure the WhatsApp outbound path sets `ptt: true` when sending audio files from TTS output.

**Files to check/modify**:
- `src/web/outbound.ts` — `sendMessageWhatsApp()`: ensure `ptt: true` in send options for audio
- `src/channels/plugins/outbound/whatsapp.ts` — `sendMedia()`: ensure `audioAsVoice` flag propagates

**Format**: Sherpa-ONNX TTS output or any TTS provider → convert to OGG Opus if not already (WhatsApp PTT requires Opus codec).

### Trigger

User explicitly asks for voice output → agent calls `tts` tool → `MEDIA:<path>` → WhatsApp sends as PTT voice note.

No automatic TTS. `ttsAuto` mode stays "off" for WhatsApp.

## Non-Goals

- Auto voice-reply (voice-to-voice) — can be added later via `ttsAuto: "inbound"`
- Streaming TTS for long responses
- WhatsApp-specific TTS config in `openclaw.json`
- Voice call integration (separate plugin)

## Files Affected

| File | Change |
|------|--------|
| `src/web/auto-reply/monitor/group-gating.ts` | Add audio preflight transcription before mention gating |
| `src/web/outbound.ts` | Ensure `ptt: true` for audio sends |
| `src/channels/plugins/outbound/whatsapp.ts` | Propagate `audioAsVoice` flag |

## Testing

1. Send a voice note to OpenClaw in a WhatsApp DM → verify it gets transcribed and the AI responds
2. Send a voice note mentioning the bot's name in a WhatsApp group → verify it passes mention gating
3. Ask OpenClaw "reply with voice" or "speak your answer" → verify PTT voice bubble is received
4. Send a voice note in a group WITHOUT mentioning the bot → verify it's still correctly dropped
