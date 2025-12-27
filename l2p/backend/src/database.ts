// Lightweight database shim for tests that mock '../../../database'
// The tests will mock these exports via jest.mock; real code uses DatabaseService
export const query = async (..._args: any[]) => ({ rows: [], rowCount: 0 });
export const release = () => { /* no-op */ };
export default { query, release };
