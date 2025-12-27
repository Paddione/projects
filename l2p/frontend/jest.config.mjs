// Auto-generated test configuration - Updated by TestRunnerConfigUpdater
// Last updated: 2025-08-14
import { TestConfigManager } from '../shared/test-config/dist/TestConfigManager.js';
import { CoverageConfigManager } from '../shared/test-config/dist/CoverageConfigManager.js';

const testEnvironment = process.env.TEST_ENVIRONMENT || 'local';
const testType = process.env.TEST_TYPE || 'unit';

const configManager = TestConfigManager.getInstance();
const coverageManager = CoverageConfigManager.getInstance();

let context;
let coverageConfig;

try {
	context = configManager.createExecutionContext(testEnvironment, testType);
	coverageConfig = coverageManager.getFrontendJestConfig();
} catch (error) {
	console.error('Failed to load test configuration:', error.message);
	context = {
		test_type_config: {
			timeout: 10000,
			verbose: false,
			bail: false,
			collect_coverage: true,
			parallel: true,
			max_workers: '50%'
		},
		environment_config: {
			coverage: {
				threshold: {
					statements: 30,
					branches: 25,
					functions: 30,
					lines: 30
				},
				exclude: [
					'**/*.test.ts',
					'**/*.test.tsx',
					'**/*.spec.ts',
					'**/*.spec.tsx',
					'**/node_modules/**',
					'**/dist/**',
					'**/coverage/**'
				]
			},
			reporting: {
				formats: ['text', 'lcov', 'html'],
				output_dir: 'coverage'
			}
		},
		global_config: {
			clear_mocks: true,
			reset_mocks: true,
			restore_mocks: true
		}
	};

	coverageConfig = {
		collectCoverageFrom: [
			'src/**/*.{ts,tsx}',
			'!src/**/*.d.ts',
			'!src/main.tsx',
			'!src/setupTests.ts',
			'!src/**/*.test.{ts,tsx}',
			'!src/**/*.spec.{ts,tsx}'
		],
		coverageDirectory: 'coverage',
		coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
		coverageThreshold: {
			global: {
				statements: 30,
				branches: 25,
				functions: 30,
				lines: 30
			}
		},
		coveragePathIgnorePatterns: [
			'.*\.test\.ts$',
			'.*\.test\.tsx$',
			'.*\.spec\.ts$',
			'.*\.spec\.tsx$',
			'/node_modules/',
			'/dist/',
			'/coverage/'
		]
	};
}

export default {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
	setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@frontend/(.*)$': '<rootDir>/src/$1',
		'\\.(css|less|scss|sass)$': 'identity-obj-proxy',
		'\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
		'\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__mocks__/fileMock.js'
	},
	transform: {
    '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.tests.json',
            diagnostics: { warnOnly: true }
        }],
		'^.+\\.jsx?$': ['babel-jest']
	},
	transformIgnorePatterns: [
		'node_modules/(?!(react-dropzone|react-router-dom|zustand|@testing-library)/)'
	],
	testMatch: [
		'<rootDir>/src/**/__tests__/**/*.(test|spec).(ts|tsx|js)',
		'<rootDir>/src/**/*.(test|spec).(ts|tsx|js)'
	],
	testPathIgnorePatterns: [
		'/node_modules/',
		'<rootDir>/src/__tests__/e2e/',
		'<rootDir>/e2e/',
		'<rootDir>/playwright-report/',
		'<rootDir>/test-results/',
		'\\.e2e\\.(ts|js)$',
		'\\.playwright\\.(ts|js)$'
	],
	collectCoverageFrom: coverageConfig.collectCoverageFrom,
	coverageDirectory: coverageConfig.coverageDirectory,
	coverageReporters: coverageConfig.coverageReporters,
	coverageThreshold: coverageConfig.coverageThreshold,
	coveragePathIgnorePatterns: coverageConfig.coveragePathIgnorePatterns,
	testTimeout: context.test_type_config.timeout,
	verbose: context.test_type_config.verbose,
	bail: context.test_type_config.bail,
	clearMocks: context.global_config.clear_mocks,
	resetMocks: context.global_config.reset_mocks,
	restoreMocks: context.global_config.restore_mocks,
	maxWorkers: context.test_type_config.parallel ? context.test_type_config.max_workers : 1,
	// Handle import.meta.env and Vite-specific features
	testEnvironmentOptions: {
		customExportConditions: ['node', 'node-addons'],
		url: 'http://localhost:3000'
	},
	// Mock Vite's import.meta.env
	setupFiles: ['<rootDir>/src/test-setup.ts'],
	globals: {
		'import.meta': {
			env: {
				MODE: 'test',
				VITE_TEST_MODE: 'true',
				VITE_API_URL: 'http://localhost:3001/api',
				VITE_SOCKET_URL: 'http://localhost:3001',
				VITE_APP_TITLE: 'Learn2Play',
				VITE_APP_VERSION: '1.0.0',
				VITE_APP_ENVIRONMENT: 'test',
				VITE_GEMINI_API_KEY: 'test-api-key',
				VITE_AZURE_CONNECTION_STRING: 'test-connection-string',
				VITE_CHROMA_URL: 'http://localhost:8000',
				VITE_CHROMA_COLLECTION: 'test-collection',
				VITE_CHROMA_API_KEY: 'test-chroma-key',
				VITE_APP_DEBUG: 'true',
				VITE_APP_LOG_LEVEL: 'debug',
				VITE_APP_FEATURE_FLAGS: '{}',
				VITE_APP_CONFIG: '{}',
				DEV: false,
				PROD: false,
				SSR: false
			}
		}
	}
};
