// Mock logging middleware for testing
export const logRequest = vi.fn((req: any, res: any, next: any) => next());
export const logError = vi.fn((error: any, req: any, res: any, next: any) => next());
export const auditLog = vi.fn();
export const requestLogger = vi.fn((req: any, res: any, next: any) => next());

export default {
  logRequest,
  logError, 
  auditLog,
  requestLogger
};
