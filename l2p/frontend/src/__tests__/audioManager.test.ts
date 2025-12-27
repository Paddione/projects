import { AudioManager } from '../services/audioManager';

// Type for accessing private members in tests
interface AudioManagerPrivate {
  audioContext: AudioContext | null;
  gainNodes: Map<string, GainNode>;
  audioBuffers: Map<string, AudioBuffer>;
  isInitialized: boolean;
  // Private methods we need to test
  loadAllAudioFiles: () => Promise<void>;
  ensureInitialized: () => Promise<void>;
  isReady: () => boolean;
  // Public methods
  playSound: (soundId: string, options?: { volume?: number; loop?: boolean }) => Promise<void>;
  stopSound: (soundId: string) => void;
  setVolume: (soundId: string, volume: number) => void;
  stopAllSounds: () => void;
  // Add the private init method to the interface
  init: () => Promise<void>;
}

// Type assertion helper
const asPrivate = (manager: AudioManager): AudioManagerPrivate => manager as unknown as AudioManagerPrivate;

// Create a complete mock for AudioParam
class MockAudioParam implements AudioParam {
  value: number = 1.0;
  automationRate: AutomationRate = 'a-rate';
  defaultValue: number = 1.0;
  maxValue: number = 1.0;
  minValue: number = 0.0;

  // Prefix unused parameters with underscore to satisfy linter
  setValueAtTime = jest.fn((_value: number, _startTime: number) => this);
  linearRampToValueAtTime = jest.fn((_value: number, _endTime: number) => this);
  exponentialRampToValueAtTime = jest.fn((_value: number, _endTime: number) => this);
  setTargetAtTime = jest.fn((_target: number, _startTime: number, _timeConstant: number) => this);
  setValueCurveAtTime = jest.fn((_values: Float32Array, _startTime: number, _duration: number) => this);
  cancelScheduledValues = jest.fn((_cancelTime: number) => this);
  cancelAndHoldAtTime = jest.fn((_cancelTime: number) => this);
}

// Create a mock for GainNode
class MockGainNode extends EventTarget implements GainNode {
  context: AudioContext;
  numberOfInputs: number = 1;
  numberOfOutputs: number = 1;
  channelCount: number = 2;
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';
  
  gain: AudioParam = new MockAudioParam();
  
  constructor(context: AudioContext) {
    super();
    this.context = context;
  }
  
  connect = jest.fn((_destinationNode: AudioNode | AudioParam) => {
    return this as unknown as GainNode;
  });
  
  disconnect = jest.fn();
  
  // EventTarget implementation with proper typing
  override addEventListener = jest.fn((_type: string, _listener: EventListener, _options?: boolean | AddEventListenerOptions): void => {
    // Mock implementation
  });
  
  override removeEventListener = jest.fn((_type: string, _listener: EventListener, _options?: boolean | EventListenerOptions) => {
    // Mock implementation
  });
  
  override dispatchEvent = jest.fn((_event: Event) => true);
}

type MockAudioBufferSourceNode = {
  // AudioScheduledSourceNode properties
  context: AudioContext;
  numberOfInputs: number;
  numberOfOutputs: number;
  channelCount: number;
  channelCountMode: ChannelCountMode;
  channelInterpretation: ChannelInterpretation;
  addEventListener: (type: string, listener: EventListener, options?: boolean | AddEventListenerOptions) => void;
  removeEventListener: (type: string, listener: EventListener, options?: boolean | EventListenerOptions) => void;
  dispatchEvent: (event: Event) => boolean;
  
  // AudioBufferSourceNode specific properties
  buffer: AudioBuffer | null;
  detune: AudioParam;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  playbackRate: AudioParam;
  onended: ((this: AudioScheduledSourceNode, ev: Event) => void) | null;
  
  // Mock methods
  connect: jest.Mock<MockAudioBufferSourceNode, [AudioNode | AudioParam]>;
  disconnect: jest.Mock<void, []>;
  start: jest.Mock<void, [number?, number?, number?]>;
  stop: jest.Mock<void, [number?]>;
  [key: string]: unknown;
};

// Minimal mock types for testing
interface MockAudioDestinationNode extends AudioNode {
  // Only include the minimal required properties
  connect: (destinationNode: AudioNode | AudioParam) => AudioNode;
  disconnect: () => void;
  maxChannelCount: number; // Add missing required property
}

interface MockAudioContext extends Omit<AudioContext, 'createGain' | 'createBufferSource' | 'decodeAudioData'> {
  // Only mock methods we actually use in tests
  createGain: jest.Mock<MockGainNode>;
  createBufferSource: jest.Mock<MockAudioBufferSourceNode>;
  decodeAudioData: jest.Mock<Promise<AudioBuffer>, [ArrayBuffer]>;
  // Add other required properties with proper types
  destination: MockAudioDestinationNode;
  currentTime: number;
  state: AudioContextState;
}

// Helper function to create a mock AudioBuffer
const createMockAudioBuffer = (options: Partial<AudioBuffer> = {}): AudioBuffer => {
  const defaults = {
    duration: 10,
    length: 441000,
    numberOfChannels: 2,
    sampleRate: 44100,
    getChannelData: jest.fn().mockReturnValue(new Float32Array(441000)),
    copyFromChannel: jest.fn(),
    copyToChannel: jest.fn()
  };
  
  return {
    ...defaults,
    ...options
  } as unknown as AudioBuffer;
};

// Create and use mockAudioBuffer directly where needed
// const mockAudioBuffer = createMockAudioBuffer(); // Commented out since it's not used directly

// Create a simple mock GainNode
const createMockGainNode = (): MockGainNode => {
  const gain = {
    value: 1,
    automationRate: 'a-rate' as const,
    defaultValue: 1,
    maxValue: 1,
    minValue: 0,
    setValueAtTime: jest.fn().mockReturnThis(),
    linearRampToValueAtTime: jest.fn().mockReturnThis(),
    exponentialRampToValueAtTime: jest.fn().mockReturnThis(),
    setTargetAtTime: jest.fn().mockReturnThis(),
    setValueCurveAtTime: jest.fn().mockReturnThis(),
    cancelScheduledValues: jest.fn().mockReturnThis(),
    cancelAndHoldAtTime: jest.fn().mockReturnThis()
  } as unknown as AudioParam;

  return {
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    gain,
    channelCount: 2,
    channelCountMode: 'max' as ChannelCountMode,
    channelInterpretation: 'speakers' as ChannelInterpretation,
    context: {} as AudioContext,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(() => true)
  } as unknown as MockGainNode;
};

const mockGainNode = createMockGainNode();

const createMockAudioBufferSourceNode = (): MockAudioBufferSourceNode => {
  const node = {
    connect: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null,
    buffer: null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    playbackRate: { value: 1 } as unknown as AudioParam,
    detune: { value: 0 } as unknown as AudioParam,
    channelCount: 2,
    channelCountMode: 'max' as ChannelCountMode,
    channelInterpretation: 'speakers' as ChannelInterpretation,
    context: {} as AudioContext,
    numberOfInputs: 0,
    numberOfOutputs: 1,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };
  return node as unknown as MockAudioBufferSourceNode;
};

// Create a minimal mock AudioDestinationNode
const mockDestinationNode: MockAudioDestinationNode = {
  connect: jest.fn(() => ({} as AudioNode)),
  disconnect: jest.fn(),
  // Required AudioNode properties with minimal implementations
  context: {} as AudioContext,
  numberOfInputs: 1,
  numberOfOutputs: 0,
  channelCount: 2,
  maxChannelCount: 2, // Add missing required property
  channelCountMode: 'max' as ChannelCountMode,
  channelInterpretation: 'speakers' as ChannelInterpretation,
  // Add type assertion to satisfy the interface
} as unknown as MockAudioDestinationNode;

// Create a minimal mock AudioContext
const mockAudioContext: MockAudioContext = {
  createGain: jest.fn(() => createMockGainNode()),
  createBufferSource: jest.fn(() => createMockAudioBufferSourceNode()),
  decodeAudioData: jest.fn(() => Promise.resolve(createMockAudioBuffer())),
  close: jest.fn(() => Promise.resolve()),
  resume: jest.fn(() => Promise.resolve()),
  suspend: jest.fn(() => Promise.resolve()),
  destination: mockDestinationNode,
  currentTime: 0,
  state: 'running' as AudioContextState,
  // Add other required AudioContext methods with minimal implementations
  createMediaElementSource: jest.fn(),
  createMediaStreamDestination: jest.fn(),
  createMediaStreamSource: jest.fn(),
  createMediaStreamTrackSource: jest.fn(),
  createOscillator: jest.fn(),
  createPanner: jest.fn(),
  createPeriodicWave: jest.fn(),
  createScriptProcessor: jest.fn(),
  createStereoPanner: jest.fn(),
  createWaveShaper: jest.fn()
} as unknown as MockAudioContext;

// Mock fetch implementation with proper typing
const createMockResponse = (): Response => {
  const response = {
    ok: true,
    headers: new Headers(),
    redirected: false,
    status: 200,
    statusText: 'OK',
    type: 'basic' as const,
    url: '',
    body: null as unknown as ReadableStream<Uint8Array> | null,
    bodyUsed: false,
    clone: function() { return this; },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    text: () => Promise.resolve(''),
    json: () => Promise.resolve({}),
    formData: () => Promise.resolve(new FormData()),
    blob: () => Promise.resolve(new Blob())
  };
  return response as unknown as Response;
};

// Create a typed mock for fetch
const mockFetchImplementation = (_input: RequestInfo | URL, _init?: RequestInit) => {
  return Promise.resolve(createMockResponse());
};

// Assign to global.fetch with proper typing
global.fetch = jest.fn(mockFetchImplementation) as typeof global.fetch;

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext as unknown as AudioContext)
});

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext as unknown as AudioContext)
});

describe('AudioManager', () => {
  let audioManager: AudioManager;
  let privateManager: AudioManagerPrivate;

  beforeEach(() => {
    // Create a fresh instance for each test
    audioManager = new AudioManager();
    privateManager = asPrivate(audioManager);

    // Mock the loadAllAudioFiles method to prevent actual file loading
    jest.spyOn(privateManager, 'loadAllAudioFiles').mockResolvedValue(undefined);
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully with valid audio context', async () => {
      // Mock the init method to simulate successful initialization
      const mockInit = jest.spyOn(privateManager, 'init').mockImplementation(async function(this: AudioManagerPrivate) {
        privateManager.audioContext = mockAudioContext;
        privateManager.gainNodes = new Map([
          ['music', mockGainNode],
          ['sound', mockGainNode],
          ['ui', mockGainNode],
          ['streak', mockGainNode]
        ]);
        privateManager.isInitialized = true;
      });

      // Initialize and verify using the private interface
      await privateManager.init();
      
      // Check initialization state
      expect(privateManager.isInitialized).toBe(true);
      expect(privateManager.audioContext).toBeDefined();
      
      // Restore original implementation
      mockInit.mockRestore();
    })

    it('should create gain nodes for different audio types', async () => {
      // Mock the init method to simulate successful initialization with gain nodes
      const mockInit = jest.spyOn(privateManager as unknown as { init: () => Promise<void> }, 'init').mockImplementation(async function(this: AudioManagerPrivate) {
        privateManager.audioContext = mockAudioContext;
        privateManager.gainNodes = new Map([
          ['music', mockGainNode],
          ['sound', mockGainNode],
          ['ui', mockGainNode],
          ['streak', mockGainNode]
        ]);
        privateManager.isInitialized = true;
      });

      // Call init and verify using the private interface
      await privateManager.init();
      
      // Check gain nodes were created
      const gainNodes = privateManager.gainNodes;
      expect(gainNodes.get('music')).toBeDefined();
      expect(gainNodes.get('sound')).toBeDefined();
      expect(gainNodes.get('ui')).toBeDefined();
      expect(gainNodes.get('streak')).toBeDefined();
      
      // Restore original implementation
      mockInit.mockRestore();
    })

    it('should handle initialization errors gracefully', async () => {
      // Mock loadAllAudioFiles to throw an error
      const mockLoad = jest.spyOn(privateManager as unknown as { loadAllAudioFiles: () => Promise<void> }, 'loadAllAudioFiles')
        .mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(privateManager.init()).rejects.toThrow('Network error');
      
      // Should log the error but not crash
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize AudioManager:', expect.any(Error));
      // Should not be initialized due to error
      expect(privateManager.isInitialized).toBe(false);
      
      // Restore original implementations
      mockLoad.mockRestore();
      consoleSpy.mockRestore();
    })
  })

  describe('Auto-initialization', () => {
    it('should auto-initialize when playSound is called for the first time', async () => {
      // Create a fresh AudioManager and prevent constructor init
      const freshAudioManager = new AudioManager();
      const freshPrivate = asPrivate(freshAudioManager);
      
      // Mock the init method - store the spy to clean up later
      const initSpy = jest.spyOn(freshPrivate, 'init').mockResolvedValue(undefined);

      // Mock ensureInitialized to track calls and simulate success
      const ensureInitSpy = jest.spyOn(freshPrivate, 'ensureInitialized').mockImplementation(async function (this: AudioManagerPrivate) {
        this.isInitialized = true;
        this.audioContext = mockAudioContext as unknown as AudioContext;
        // Initialize gain nodes map if needed
        if (!this.gainNodes) {
          this.gainNodes = new Map();
        }
        return Promise.resolve();
      });

      // Mock isReady to return false initially, then true after ensureInitialized
      let readyCallCount = 0;
      const isReadySpy = jest.spyOn(freshPrivate, 'isReady').mockImplementation(() => {
        readyCallCount++;
        return readyCallCount > 1; // false first time, true after that
      });

      try {
        // Call playSound - this should trigger auto-initialization via the wrapper
        await freshAudioManager.playSound('test-sound');

        // Should have called ensureInitialized
        expect(ensureInitSpy).toHaveBeenCalled();
      } finally {
        // Clean up all spies
        initSpy.mockRestore();
        ensureInitSpy.mockRestore();
        isReadySpy.mockRestore();
      }
    })

    it('should not re-initialize if already initialized', async () => {
      // Manually set the initialized state
      const privateManager = asPrivate(audioManager);
      privateManager.isInitialized = true;
      privateManager.audioContext = mockAudioContext as unknown as AudioContext;

      const initSpy = jest.spyOn(audioManager as AudioManager, 'init' as never)

      // Call playSound again
      await audioManager.playSound('test-sound')

      // Should not call init again
      expect(initSpy).not.toHaveBeenCalled()
    })

    it('should handle initialization errors gracefully', async () => {
      // Create a fresh AudioManager
      const freshAudioManager = new AudioManager()

      // Mock ensureInitialized to throw an error
      jest.spyOn(freshAudioManager, 'ensureInitialized').mockRejectedValue(new Error('Init failed'))

      // Mock isReady to return false
      jest.spyOn(freshAudioManager, 'isReady').mockReturnValue(false)

      // Should not crash and should log a warning
      const consoleSpy = jest.spyOn(console, 'warn')

      await freshAudioManager.playSound('test-sound')

      expect(consoleSpy).toHaveBeenCalledWith('AudioManager not initialized')
    })
  })

  describe('Audio playback', () => {
    beforeEach(() => {
      // Set up the audio manager state for playback tests using type-safe private access
      const privateManager = asPrivate(audioManager);
      privateManager.isInitialized = true;
      privateManager.audioContext = mockAudioContext as unknown as AudioContext;
      privateManager.audioBuffers = new Map([
        ['test-sound', createMockAudioBuffer()]
      ]);
      privateManager.gainNodes = new Map([
        ['music', mockGainNode as unknown as GainNode],
        ['sound', mockGainNode as unknown as GainNode],
        ['ui', mockGainNode as unknown as GainNode],
        ['streak', mockGainNode as unknown as GainNode]
      ]);
    })

    it('should play sounds when initialized', () => {
      const consoleSpy = jest.spyOn(console, 'warn')

      audioManager.playSound('test-sound')

      // Should not warn about not being initialized
      expect(consoleSpy).not.toHaveBeenCalledWith('AudioManager not initialized')
    })

    it('should handle unknown sound names gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn')

      audioManager.playSound('unknown-sound')

      expect(consoleSpy).toHaveBeenCalledWith('Audio file not found: unknown-sound')
    })
  })
})
