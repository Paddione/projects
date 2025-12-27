# Command Center Expansion Plan

The "VRAM Mastermind" dashboard has been transitioned into a Command Center. Here are the planned functionalities to further enhance its capabilities:

## 1. Mass Operations
- **Start All / Stop All / Restart All**: Buttons at the top of the dashboard to control the entire stack with a single click.
- **Dependency Awareness**: When starting a service like `Open-WebUI`, the dashboard should offer to start its dependencies (`vllm`, `qdrant`, etc.) if they are not running.

## 2. Advanced Monitoring
- **Real-time Log Streaming**: Add a "Logs" button to each service card that opens a terminal-like modal showing the last 100 lines and streaming new logs via Socket.io.
- **CPU & System RAM Tracking**: Provide a more comprehensive overview of system health beyond just VRAM.
- **Process List**: For `process` type services, show child processes if any.

## 3. Alerts & Automation
- **VRAM Threshold Alerts**: Visual or browser notifications when VRAM exceeds 90% or 95%.
- **Auto-restart on Failure**: Option to toggle "Auto-restart" for critical services that crash unexpectedly.
- **Scheduled Maintenance**: Ability to schedule service restarts or updates.

## 4. Configuration Management
- **Environment Variable Editor**: A secure UI to edit `.env` variables and restart affected services automatically.
- **Docker Compose Sync**: Ability to pull the latest images and recreate containers from the UI.

## 5. Security & Multi-user
- **Role-based Access**: (Optional) If multiple people use the dashboard, define who can "View" vs "Control".
- **Activity Log**: Keep track of who started/stopped what service and when.

---

### Implementation Priority:
1. **Mass Operations** (High)
2. **Real-time Log Streaming** (Medium-High)
3. **CPU/System RAM Tracking** (Medium)
4. **Environment Editor** (Low-Medium)
