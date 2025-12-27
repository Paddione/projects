import { jest } from '@jest/globals';

/**
 * A simple module mocker for Jest that works with ESM modules
 */
export class ModuleMocker {
  private static instance: ModuleMocker;
  private mocks: Map<string, any> = new Map();
  
  private constructor() {}
  
  public static getInstance(): ModuleMocker {
    if (!ModuleMocker.instance) {
      ModuleMocker.instance = new ModuleMocker();
    }
    return ModuleMocker.instance;
  }
  
  /**
   * Mocks a module with the given implementation
   */
  public mockModule(modulePath: string, implementation: any = {}): any {
    if (this.mocks.has(modulePath)) {
      return this.mocks.get(modulePath);
    }
    
    const mock = {
      __esModule: true,
      ...implementation,
    };
    
    jest.unstable_mockModule(modulePath, () => Promise.resolve(mock));
    this.mocks.set(modulePath, mock);
    
    return mock;
  }
  
  /**
   * Resets all mocks and modules
   */
  public resetAllMocks(): void {
    this.mocks.clear();
    jest.restoreAllMocks();
    jest.resetModules();
  }
  
  /**
   * Clears all mocks
   */
  public clearAllMocks(): void {
    this.mocks.clear();
    jest.clearAllMocks();
  }
  
  /**
   * Gets a mocked module
   */
  public getMock(modulePath: string): any | undefined {
    return this.mocks.get(modulePath);
  }
}

// Export a singleton instance
export const moduleMocker = ModuleMocker.getInstance();

export default moduleMocker;
