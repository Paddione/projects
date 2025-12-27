// ESM-friendly Jest mock for bcrypt
// Provides minimal compatible API used in the codebase
export async function genSalt(rounds?: number): Promise<string> {
  return Promise.resolve(`$2b$${rounds || 10}$testsalt`);
}

export async function hash(data: string, saltOrRounds: string | number): Promise<string> {
  // Simple deterministic mock hash
  const salt = typeof saltOrRounds === 'number' ? await genSalt(saltOrRounds) : (saltOrRounds || '$2b$10$testsalt');
  return Promise.resolve(`mockhash:${salt}:${data}`);
}

export async function compare(data: string, encrypted: string): Promise<boolean> {
  // Accept if encrypted string includes data
  return Promise.resolve(encrypted.includes(data));
}

export default { genSalt, hash, compare };
