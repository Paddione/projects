# Browser Control Model: Findings & Research

## 1. Requirement Analysis
The objective was to create a "browser control model" that:
- Encompasses all projects (`l2p`, `VideoVault`, `payment`, `vllm`).
- Supports modular execution in "smaller groups".
- Integrates with existing infrastructure.

## 2. Technical Audit
### A. Fragmentation Status
- **l2p**: Uses Playwright with multiple config files (`playwright.config.ts`, `playwright-simple.config.ts`).
- **VideoVault**: High-dependency on Playwright for E2E in Docker.
- **Payment**: Next.js app with standard Playwright integration.
- **vllm**: No native browser control; primarily an MCP server and dashboard.

### B. Identified Gaps
1. **Lack of Centralized Health Check**: Currently requires navigating to 4 different URLs manually or running 3 different test suites.
2. **Setup Overhead**: Automation scripts are buried in deep subdirectories.
3. **No Visual Orchestration**: The VRAM Command Center can control services but not verify their UI state.

## 3. Solutions Developed
### A. The BCM Registry (`browser_control_registry.json`)
A root-level configuration that defines "Groups" of browser tasks. This allows the system to be aware of all projects simultaneously while allowing execution of specific subsets (e.g., `vllm_group`).

### B. Dashboard integration (BCC - Browser Control Center)
Modified the VRAM Dashboard's `server.js` to:
- Expose an API for listing browser groups.
- Execute task groups in the background.
- Stream real-time progress via Socket.io.

## 4. Next Steps for Full Implementation
1. **Refine Runner**: Replace the mock simulation in `server.js` with calls to `npx playwright test` targeting specific project folders.
2. **UI Components**: Create a "Browser Hub" tab in the dashboard frontend.
3. **Automated Verification**: Use the BCM to automatically verify that a service is *functional* (not just *running*) after a restart.
