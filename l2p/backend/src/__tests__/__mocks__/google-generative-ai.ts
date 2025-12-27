// Jest-friendly mock for '@google/generative-ai'
// Provides a minimal class API that tests can spy on/override.

export class GoogleGenerativeAI {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Return a simple model object whose method can be overridden in tests
  getGenerativeModel(_options?: any) {
    return {
      // Default behavior returns an empty JSON array as text
      generateContent: async (_input: any) => ({
        response: {
          text: () => '[]',
        },
      }),
    } as any;
  }
}

export default GoogleGenerativeAI;
