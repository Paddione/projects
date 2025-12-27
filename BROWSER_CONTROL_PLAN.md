# Antigravity Browser Control (ABC) Framework Plan

## 1. Overview
The **Antigravity Browser Control (ABC)** framework is designed to provide a unified, modular, and AI-optimized interface for browser automation across the entire monorepo (`l2p`, `VideoVault`, `payment`, `vllm`). It addresses the current fragmentation by centralizing orchestration while allowing projects to maintain their specific E2E logic.

## 2. Findings & Current State
- **Project-Specific Silos**: `l2p`, `VideoVault`, and `payment` each have independent Playwright configurations.
- **Redundant Setup**: Browser installation and environment prep must be done per project.
- **Inconsistent Execution**: Test commands vary (`npm run test:e2e` vs `npm test` vs custom scripts).
- **Manual Intervention**: Cross-project scenarios (e.g., "Login in Auth -> Use L2P -> Check Dashboard") are difficult to automate.

## 3. Proposed Architecture

### A. Core Controller (The "Hub")
- **Location**: `/browser-control` (New root directory)
- **Role**: Dispatches commands to project-specific drivers.
- **Tech Stack**: Playwright (orchestrator), TypeScript.

### B. Project Drivers (The "Spokes")
Each project will have a "Driver Assistant" that extends a base interface:
- `BaseDriver`: Abstract class with `login()`, `logout()`, `healthCheck()`, `cleanup()`.
- `L2PDriver`, `VideoVaultDriver`, `PaymentDriver`, `DashboardDriver`: Implementation-specific logic.

### C. Execution Groups
Tasks are organized into groups for modularity:
- **`health-all`**: Rapid pulse check of all service UIs.
- **`auth-cycle`**: Verifies login/session persistence across all subdomains.
- **`data-flow`**: Tests data movement (e.g., Payment success -> VideoVault premium feature activation).
- **`smoke-group-<project>`**: Project-specific smoke tests.

## 4. Features & Capabilities
- **Session Sharing**: Shared cookie/localStorage state between adapters where relevant.
- **Dependency Awareness**: ABC can trigger `setup.sh` or Docker starts if targets are offline.
- **Rich Reporting**: Unified HTML/JSON report encompassing all triggered groups.
- **AI-Ready**: Optimized for Antigravity (me) to trigger via simple CLI commands.

## 5. Implementation Roadmap

### Phase 1: Foundation (Current Task)
1. Initialize `browser_control_registry.json` at root.
2. Implement **Browser Control API** in `vllm/dashboard/server.js`.
3. Create "Browser Hub" UI section in the dashboard.

### Phase 2: Project Bridging
1. Map project-specific E2E commands (Playwright) to the Hub.
2. Implement "Smaller Groups" execution (e.g. `l2p-smoke`, `vv-health`) via dashboard buttons.

### Phase 3: Advanced Automation
1. Add "Automated Release Check": A button that runs health checks on all apps and reports status.
2. Integrate "Screen Capture": Dashboard shows live or last-known screenshot of browser tasks.

---

## Solutions Implemented
- **`browser_control_registry.json`**: Centralized task and group definitions.
- **Unified Plan**: Comprehensive strategy for cross-project browser orchestration.
