// Temporary stub - OAuth implementation in progress

export class OAuthService {
  async exchangeCode(code: string): Promise<any> {
    throw new Error('OAuth service not yet implemented');
  }

  async refreshToken(refreshToken: string): Promise<any> {
    throw new Error('OAuth service not yet implemented');
  }

  async revokeToken(token: string, tokenType?: string): Promise<void> {
    throw new Error('OAuth service not yet implemented');
  }

  getConfig(): any {
    throw new Error('OAuth service not yet implemented');
  }
}
