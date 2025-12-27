# WSL-Windows Bridge Setup

To enable the most sensible and performant access between your WSL environment and Windows, the following steps are recommended:

## 1. Accessing Windows Files from WSL (Already Configured)
I have created unified shortcuts in your home directory for instant access to all your Windows drives and user profile:

- **All Drives**: `~/win/` (contains shortcuts to `c/`, `d/`, and `e/`)
- **User Profile**: `~/winhome` points directly to your Windows user folder (`PatrickKorczewski`)
- **Usage**: 
  - `cd ~/win/d` to jump to your D: drive.
  - `cd ~/winhome/Desktop` to jump to your Windows desktop.

## 2. Accessing WSL Code from Windows Explorer
Windows can access your WSL files directly via the network path.
- **Path**: `\\wsl.localhost\Ubuntu\home\patrick\vllm`
- **Tip**: You can paste this path into the Windows Explorer address bar or map it as a Network Drive (Right-click "This PC" > Map network drive).

## 3. Recommended Development Workflow (VS Code)
If you use VS Code, the most sensible way to work is:
1. Install the **"WSL" extension** (by Microsoft) in VS Code.
2. In your WSL terminal, navigate to your project and type:
   ```bash
   code .
   ```
3. This opens VS Code on Windows but runs the backend (including terminal, git, and debugger) inside WSL for maximum performance and compatibility.

## 4. Connecting your IDE to your local QWEN Model
You can use your local QWEN model (running via vLLM) instead of an external AI.

### Connection Details:
- **Base URL**: `http://localhost:4100/v1`
- **Model Name**: `Qwen/Qwen2.5-Coder-7B-Instruct-AWQ`
- **API Key**: `1b0e2e7759dbc1e2b8a520655079363770a06b404b1d69b3b3e3649918f8801c`

### Setup in IDE (e.g., Continue, Cline, or Roo Code):
1. Open your IDE's AI configuration.
2. Select **OpenAI-Compatible** or **vLLM** as the provider.
3. Use the **Base URL** and **API Key** from above.
4. Set the model ID to `Qwen/Qwen2.5-Coder-7B-Instruct-AWQ`.

## 5. Helper Command: Open current folder in Windows
You can always open the current WSL folder in a Windows Explorer window by running:
```bash
explorer.exe .
```
