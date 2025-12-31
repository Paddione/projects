# Task Management

This file is used by AI agents to track ongoing tasks, coordinate efforts, and avoid interference.

## Active Tasks

| Task ID | Status | Owner | Description | Last Update |
| :--- | :--- | :--- | :--- | :--- |
| `TASK-012` | 🟡 In Progress | Codex | Investigate why l2p.korczewski.de is not responding | 2025-12-31 |
| `TASK-008` | ✅ Done | Codex | Investigate failing VideoVault and l2p/shared/test-config tests from latest runs | 2025-12-30 |
| `TASK-009` | ✅ Done | Codex | Align WebCodecs thumbnail service mock support detection with production behavior | 2025-12-30 |
| `TASK-001` | ✅ Done | Antigravity | Estalishing Reverse Proxy Bridge (Local Sync/Mount) | 2025-12-28 |
| `TASK-002` | ✅ Done | Antigravity | Auth Service Logic & Email Integration | 2025-12-28 |
| `TASK-003` | ✅ Done | Codex | Project-wide dependency audit and cleanup | 2025-12-30 |
| `TASK-004` | ✅ Done | Codex | Set VideoVault public domain and add NPM proxy guidance | 2025-12-28 |
| `TASK-005` | ✅ Done | Codex | Audit l2p tests that are skipped/ignored (backend unit ignore patterns, skipped frontend unit + e2e, and stray .skip/.backup/.disabled files) and decide whether to re-enable or remove | 2025-12-28 |
| `TASK-006` | ✅ Done | Codex | Enable VideoVault server tests (wire `vitest.server.config.ts`) and resolve excluded/enforced skips (enhanced-thumbnail + edit-tags-modal tests) | 2025-12-30 |
| `TASK-007` | ✅ Done | Codex | Reconcile `l2p/shared/test-config` test coverage (jest testMatch ignores .test.js + .bak file) | 2025-12-30 |
| `TASK-010` | ✅ Done | Codex | Review unit tests across monorepo (l2p, VideoVault, payment, vllm) | 2025-12-31 |
| `TASK-011` | ✅ Done | Codex | Stabilize useToast unit tests and remove debug logs in GameService tests | 2025-12-31 |

## Task History

| Task ID | Status | Completion Date | Summary |
| :--- | :--- | :--- | :--- |
| `TASK-000` | ✅ Done | 2025-12-28 | Initialized `TASKS.md` for coordination |
| `TASK-003` | ✅ Done | 2025-12-30 | Audited dependencies, removed unused/duplicate entries, and aligned lockfiles |
| `TASK-006` | ✅ Done | 2025-12-30 | Enabled VideoVault server tests and re-enabled enhanced-thumbnail + edit-tags-modal coverage |
| `TASK-007` | ✅ Done | 2025-12-30 | Removed stale .test.js/.bak test artifacts from test-config |
| `TASK-010` | ✅ Done | 2025-12-31 | Reviewed unit tests across monorepo |
| `TASK-011` | ✅ Done | 2025-12-31 | Reset toast test state and removed GameService debug logs |

## Ongoing System Maintenance
- [x] Establish Reverse Proxy Bridge (Local Sync/Mount) - See `.agent/workflows/reverse-proxy.md`
- [x] Implement Email Service for Auth (Nodemailer/SMTP)
- [x] Enforce Username Normalization (lowercase)
- [x] Secure Password Reset Flow (Removed token leaks)
- [x] Add Security Email Alerts (Standard Practice)
- [ ] Monitor Nginx Proxy Manager logs
- [ ] Ensure all services in monorepo are running correctly
