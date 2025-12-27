import { spawn, ChildProcessByStdio } from 'child_process';
import { type Readable, type Writable } from 'stream';
import { jest, describe, afterAll, beforeAll, it, expect } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, '../../build/src/index.js');

describe('VLLM MCP Server E2E', () => {
    let serverProcess: ChildProcessByStdio<Writable, Readable, Readable>;
    let requestId = 1;

    beforeAll(async () => {
        // Ensure the server is built
        // (Assuming build exists from previous runs or we can run it here if needed)

        serverProcess = spawn('node', [SERVER_PATH], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, VLLM_BASE_URL: 'http://localhost:4100' }
        });

        // Ignore stderr or log it
        serverProcess.stderr.on('data', (data) => {
            // console.error(`Server Debug: ${data}`);
        });
    });

    afterAll(() => {
        if (serverProcess) {
            serverProcess.kill();
        }
    });

    function sendRequest(method: string, params: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = requestId++;
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };

            const timeout = setTimeout(() => {
                serverProcess.stdout.removeListener('data', onData);
                reject(new Error(`Request timeout: ${method}`));
            }, 5000);

            const onData = (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === id) {
                        clearTimeout(timeout);
                        serverProcess.stdout.removeListener('data', onData);
                        resolve(response);
                    }
                } catch (e) {
                    // Ignore parsing errors from incomplete data or other messages
                }
            };

            serverProcess.stdout.on('data', onData);
            serverProcess.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    it('should respond to notifications/initialized', async () => {
        // The SDK usually sends an initialize request first
        const initResult = await sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' }
        });
        expect(initResult.result).toBeDefined();
        expect(initResult.result.capabilities).toBeDefined();
    });

    it('should list tools', async () => {
        const result = await sendRequest('tools/list');
        expect(result.result.tools).toBeDefined();
        expect(result.result.tools.length).toBeGreaterThan(0);
        expect(result.result.tools.some((t: any) => t.name === 'analyze_repository')).toBe(true);
    });

    it('should handle tool calls with validation errors for missing args', async () => {
        const result = await sendRequest('tools/call', {
            name: 'analyze_repository',
            arguments: {} // Missing repository_path
        });
        // console.log('Invalid tool call result:', JSON.stringify(result));
        // If it returns a result with isError but no JSON-RPC error, we should check for that
        expect(result.error || result.result?.isError).toBeDefined();
    });

    it('should handle analyze_repository with invalid path gracefully', async () => {
        const result = await sendRequest('tools/call', {
            name: 'analyze_repository',
            arguments: { repository_path: '/non/existent/path' }
        });
        // This should hit the internal error handler in index.ts
        expect(result.result.isError).toBe(true);
        expect(result.result.content[0].text).toContain('Error');
    });
});
