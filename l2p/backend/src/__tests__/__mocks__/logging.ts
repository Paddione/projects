// Mock logging middleware for testing
export const logRequest = jest.fn((req: any, res: any, next: any) => next());
export const logError = jest.fn((error: any, req: any, res: any, next: any) => next());
export const auditLog = jest.fn();
export const requestLogger = jest.fn((req: any, res: any, next: any) => next());

export default {
  logRequest,
  logError, 
  auditLog,
  requestLogger
};
