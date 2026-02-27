# WhatsApp Audio Message Support — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable OpenClaw to accept WhatsApp voice notes (transcribe for group mention gating) and verify TTS voice output renders as PTT voice bubbles.

**Architecture:** Add audio preflight transcription to WhatsApp group gating (mirroring the existing Telegram pattern), and verify the outbound auto-reply path already sends TTS audio with `ptt: true`. The inbound change makes `applyGroupGating` async; the outbound path requires no code changes (only verification).

**Tech Stack:** TypeScript, Vitest, `transcribeFirstAudio()` from media-understanding pipeline, `matchesMentionPatterns()` for transcript mention matching.

---

### Task 1: Add Audio Preflight Transcription to WhatsApp Group Gating

**Files:**
- Modify: `openclaw/src/web/auto-reply/monitor/group-gating.ts` (full file, 150 lines)
- Reference: `openclaw/src/telegram/bot-message-context.ts:407-433` (Telegram pattern)
- Reference: `openclaw/src/media-understanding/audio-preflight.ts` (`transcribeFirstAudio()`)
- Reference: `openclaw/src/auto-reply/reply/mentions.ts:72-81` (`matchesMentionPatterns()`)

**Step 1: Make `applyGroupGating` async and add audio preflight logic**

The function must become `async` because `transcribeFirstAudio()` is async. Add audio preflight transcription between the mention debug check (line 90) and the mention gating decision (line 117).

```typescript
// At top of file, add imports:
import type { MsgContext } from "../../../auto-reply/templating.js";
import { matchesMentionPatterns } from "../../../auto-reply/reply/mentions.js";

// Change function signature from:
export function applyGroupGating(params: {
// To:
export async function applyGroupGating(params: {
```

After `const mentionDebug = debugMention(...)` (line 90) and before `const wasMentioned = mentionDebug.wasMentioned` (line 99), insert:

```typescript
  // Audio preflight: transcribe voice notes before mention gating.
  // Without this, audio-only messages in groups with requireMention are silently dropped.
  let wasMentioned = mentionDebug.wasMentioned;
  const hasAudio = params.msg.mediaType?.startsWith("audio/") === true;
  const isAudioOnly = hasAudio && params.msg.body === "<media:audio>";
  if (!wasMentioned && isAudioOnly && params.msg.mediaPath) {
    try {
      const { transcribeFirstAudio } = await import(
        "../../../media-understanding/audio-preflight.js"
      );
      const tempCtx: MsgContext = {
        MediaPaths: [params.msg.mediaPath],
        MediaTypes: params.msg.mediaType ? [params.msg.mediaType] : undefined,
      };
      const transcript = await transcribeFirstAudio({
        ctx: tempCtx,
        cfg: params.cfg,
        agentDir: undefined,
      });
      if (transcript) {
        params.logVerbose(
          `Audio preflight transcript (${transcript.length} chars): "${transcript.slice(0, 80)}"`,
        );
        const mentionConfig = buildMentionConfig(params.cfg, params.agentId);
        if (matchesMentionPatterns(transcript, mentionConfig.mentionRegexes)) {
          wasMentioned = true;
        }
      }
    } catch (err) {
      params.logVerbose(`whatsapp: audio preflight transcription failed: ${String(err)}`);
    }
  }
```

Remove the existing `const wasMentioned = mentionDebug.wasMentioned;` on line 99 (replaced by the `let` above).

The rest of the function stays unchanged — `wasMentioned` flows into `resolveMentionGating()` on line 117-123.

**Step 2: Update caller to await the async function**

Modify: `openclaw/src/web/auto-reply/monitor/on-message.ts:127`

```typescript
// Change from:
      const gating = applyGroupGating({
// To:
      const gating = await applyGroupGating({
```

The caller is already in an `async` function (`return async (msg: WebInboundMsg) => {`), so this is a simple change.

**Step 3: Run existing tests to verify no regressions**

Run: `cd /home/patrick/projects/openclaw && npx vitest run src/web/auto-reply/monitor/group-gating.test.ts`

Expected: All 6 existing tests pass (they don't involve audio, so async change is transparent).

Note: The test helper `runGroupGating` must also become async and callers must use `await`. Update:

```typescript
// In group-gating.test.ts, change:
function runGroupGating(params: {
// To:
async function runGroupGating(params: {

// And change:
  const result = applyGroupGating({
// To:
  const result = await applyGroupGating({

// And update ALL test calls from:
    const { result } = runGroupGating({
// To:
    const { result } = await runGroupGating({

// And:
    const { result, groupHistories } = runGroupGating({
// To:
    const { result, groupHistories } = await runGroupGating({
```

**Step 4: Commit**

```bash
git add src/web/auto-reply/monitor/group-gating.ts src/web/auto-reply/monitor/on-message.ts src/web/auto-reply/monitor/group-gating.test.ts
git commit -m "feat(whatsapp): add audio preflight transcription to group mention gating

Mirror the Telegram pattern: transcribe voice notes before mention
gating so audio-only messages with spoken mentions aren't silently
dropped in groups with requireMention: true."
```

---

### Task 2: Add Test for Audio Preflight in Group Gating

**Files:**
- Modify: `openclaw/src/web/auto-reply/monitor/group-gating.test.ts`

**Step 1: Write test for voice note with mention in transcript**

```typescript
it("transcribes audio and detects mention in transcript (preflight)", async () => {
  const { vi } = await import("vitest");

  // Mock transcribeFirstAudio to return a transcript containing the mention
  vi.doMock("../../../media-understanding/audio-preflight.js", () => ({
    transcribeFirstAudio: vi.fn().mockResolvedValue("hey @openclaw what's up"),
  }));

  // Re-import to pick up mock
  const { applyGroupGating: gatingWithMock } = await import("./group-gating.js");

  const cfg = makeConfig({
    messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
  });

  const groupHistories = new Map();
  const baseMentionConfig = buildMentionConfig(cfg, undefined);

  const result = await gatingWithMock({
    cfg,
    msg: {
      id: "audio-mention",
      from: "123@g.us",
      conversationId: "123@g.us",
      chatId: "123@g.us",
      chatType: "group",
      to: "+2",
      body: "<media:audio>",
      mediaPath: "/tmp/test-audio.ogg",
      mediaType: "audio/ogg",
      senderE164: "+111",
      senderName: "Alice",
      selfE164: "+999",
      sendComposing: async () => {},
      reply: async () => {},
      sendMedia: async () => {},
    } as any,
    conversationId: "123@g.us",
    groupHistoryKey: "whatsapp:default:group:123@g.us",
    agentId: "main",
    sessionKey: "agent:main:whatsapp:group:123@g.us",
    baseMentionConfig,
    groupHistories,
    groupHistoryLimit: 10,
    groupMemberNames: new Map(),
    logVerbose: () => {},
    replyLogger: { debug: () => {} },
  });

  expect(result.shouldProcess).toBe(true);

  vi.doUnmock("../../../media-understanding/audio-preflight.js");
});
```

**Step 2: Write test for voice note WITHOUT mention in transcript**

```typescript
it("drops audio-only group message when transcript has no mention", async () => {
  const { vi } = await import("vitest");

  vi.doMock("../../../media-understanding/audio-preflight.js", () => ({
    transcribeFirstAudio: vi.fn().mockResolvedValue("just talking about random stuff"),
  }));

  const { applyGroupGating: gatingWithMock } = await import("./group-gating.js");

  const cfg = makeConfig({
    messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
  });

  const groupHistories = new Map();
  const baseMentionConfig = buildMentionConfig(cfg, undefined);

  const result = await gatingWithMock({
    cfg,
    msg: {
      id: "audio-no-mention",
      from: "123@g.us",
      conversationId: "123@g.us",
      chatId: "123@g.us",
      chatType: "group",
      to: "+2",
      body: "<media:audio>",
      mediaPath: "/tmp/test-audio.ogg",
      mediaType: "audio/ogg",
      senderE164: "+111",
      senderName: "Bob",
      selfE164: "+999",
      sendComposing: async () => {},
      reply: async () => {},
      sendMedia: async () => {},
    } as any,
    conversationId: "123@g.us",
    groupHistoryKey: "whatsapp:default:group:123@g.us",
    agentId: "main",
    sessionKey: "agent:main:whatsapp:group:123@g.us",
    baseMentionConfig,
    groupHistories,
    groupHistoryLimit: 10,
    groupMemberNames: new Map(),
    logVerbose: () => {},
    replyLogger: { debug: () => {} },
  });

  expect(result.shouldProcess).toBe(false);

  vi.doUnmock("../../../media-understanding/audio-preflight.js");
});
```

**Step 3: Write test for preflight transcription failure (graceful degradation)**

```typescript
it("falls back to text-only mention check when audio preflight fails", async () => {
  const { vi } = await import("vitest");

  vi.doMock("../../../media-understanding/audio-preflight.js", () => ({
    transcribeFirstAudio: vi.fn().mockRejectedValue(new Error("whisper not found")),
  }));

  const { applyGroupGating: gatingWithMock } = await import("./group-gating.js");

  const cfg = makeConfig({
    messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
  });

  const groupHistories = new Map();
  const baseMentionConfig = buildMentionConfig(cfg, undefined);

  const result = await gatingWithMock({
    cfg,
    msg: {
      id: "audio-fail",
      from: "123@g.us",
      conversationId: "123@g.us",
      chatId: "123@g.us",
      chatType: "group",
      to: "+2",
      body: "<media:audio>",
      mediaPath: "/tmp/test-audio.ogg",
      mediaType: "audio/ogg",
      senderE164: "+111",
      senderName: "Carol",
      selfE164: "+999",
      sendComposing: async () => {},
      reply: async () => {},
      sendMedia: async () => {},
    } as any,
    conversationId: "123@g.us",
    groupHistoryKey: "whatsapp:default:group:123@g.us",
    agentId: "main",
    sessionKey: "agent:main:whatsapp:group:123@g.us",
    baseMentionConfig,
    groupHistories,
    groupHistoryLimit: 10,
    groupMemberNames: new Map(),
    logVerbose: () => {},
    replyLogger: { debug: () => {} },
  });

  // Falls back to text check — "<media:audio>" doesn't match "@openclaw", so dropped
  expect(result.shouldProcess).toBe(false);

  vi.doUnmock("../../../media-understanding/audio-preflight.js");
});
```

**Step 4: Run all tests**

Run: `cd /home/patrick/projects/openclaw && npx vitest run src/web/auto-reply/monitor/group-gating.test.ts`
Expected: All 9 tests pass (6 existing + 3 new).

**Step 5: Commit**

```bash
git add src/web/auto-reply/monitor/group-gating.test.ts
git commit -m "test(whatsapp): add tests for audio preflight in group mention gating"
```

---

### Task 3: Verify Outbound TTS → WhatsApp Voice Note Path

This task is **verification only** — the code already works. No changes expected.

**Files:**
- Verify: `openclaw/src/web/auto-reply/deliver-reply.ts:119-129` (sends audio with `ptt: true`)
- Verify: `openclaw/src/agents/tools/tts-tool.ts` (returns `MEDIA:<path>`)
- Verify: `openclaw/src/auto-reply/reply/reply-delivery.ts:27` (parses `MEDIA:` directives)

**Step 1: Trace the outbound flow**

Confirm the path: Agent calls `tts` tool → returns `MEDIA:<audio_path>` → `normalizeReplyPayloadDirectives()` extracts `mediaUrl` → `deliverWebReply()` calls `loadWebMedia()` → detects `kind === "audio"` → sends with `{ audio: buffer, ptt: true, mimetype }`.

Verify in `deliver-reply.ts:119-129`:
```typescript
} else if (media.kind === "audio") {
  await sendWithRetry(
    () =>
      msg.sendMedia({
        audio: media.buffer,
        ptt: true,               // ← Already set!
        mimetype: media.contentType,
        caption,
      }),
    "media:audio",
  );
}
```

This confirms: **the auto-reply outbound path already sends TTS audio as WhatsApp voice notes (PTT).** No code change needed.

**Step 2: Check existing outbound test coverage**

Run: `cd /home/patrick/projects/openclaw && npx vitest run src/web/outbound.test.ts`
Expected: Tests pass, including the PTT mime type test ("maps audio to PTT with opus mime when ogg").

**Step 3: Note the channel plugin gap (out of scope)**

`sendMessageWhatsApp()` in `src/web/outbound.ts` does NOT set `ptt: true` — audio sent via the gateway API or cross-channel routing will appear as file attachments, not voice bubbles. This is out of scope for Approach A but can be added later by extending `ActiveWebSendOptions` with a `ptt` field.

No commit needed — this is verification only.

---

### Task 4: End-to-End Manual Verification

**Step 1: Rebuild and restart OpenClaw**

```bash
cd /home/patrick/projects/openclaw && docker compose build openclaw-gateway && docker compose up -d openclaw-gateway
```

**Step 2: Test inbound audio (DM)**

Send a voice note to OpenClaw in a WhatsApp DM. Expected:
- Audio is downloaded and saved
- Audio is transcribed during agent processing
- AI responds based on the transcribed text

**Step 3: Test inbound audio (group with mention)**

Send a voice note in a WhatsApp group saying the bot's mention pattern (e.g., "Hey @openclaw, what's the weather?"). Expected:
- Audio preflight transcribes the voice note
- Mention is detected in transcript
- AI processes and responds

**Step 4: Test outbound TTS**

In a WhatsApp DM, send: "Reply to me with a voice message". Expected:
- Agent calls `tts` tool
- Voice note appears as a PTT bubble (not a file attachment)

**Step 5: Test negative case (group, no mention)**

Send a voice note in a group without mentioning the bot. Expected:
- Audio preflight transcribes
- No mention found
- Message correctly dropped (stored in group history)
