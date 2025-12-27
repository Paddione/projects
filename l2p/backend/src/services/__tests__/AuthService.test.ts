import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuthService } from '../AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { EmailService } from '../EmailService';
import { User, RegisterData, LoginCredentials } from '../../types/User';
import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import * as crypto from 'crypto';

type TokenPayload = {
  isAdmin: boolean;
  userId: number;
  username: string;
  email: string;
  selectedCharacter: string;
  characterLevel: number;
};

// Mock the dependencies
jest.mock('../../repositories/UserRepository');
jest.mock('../EmailService');
jest.mock('crypto');

// Mock JWT with inline factory
jest.mock('jsonwebtoken', () => {
  const mockSign = jest.fn((payload: any, secret: string, options?: any) => {
    if (secret.includes('refresh') || options?.expiresIn === '7d') {
      return 'mock-refresh-token';
    } else if (options?.expiresIn === '15m' || secret.includes('jwt')) {
      return 'mock-access-token';
    }
    return 'mock-token';
  });

  const mockVerify = jest.fn((token: string, secret: string, options?: any) => {
    if (token === 'valid-token' || token === 'valid-refresh-token') {
      return {
        userId: 1,
        username: 'testuser',
        email: 'test@example.com',
        selectedCharacter: 'student',
        characterLevel: 1,
        isAdmin: false
      };
    }
    throw new Error('Invalid token');
  });

  return {
    __esModule: true,
    default: {
      sign: mockSign,
      verify: mockVerify,
      JsonWebTokenError: class extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'JsonWebTokenError';
        }
      },
      TokenExpiredError: class extends Error {
        public expiredAt: Date;
        constructor(message: string, expiredAt: Date) {
          super(message);
          this.name = 'TokenExpiredError';
          this.expiredAt = expiredAt;
        }
      }
    },
    sign: mockSign,
    verify: mockVerify,
    JsonWebTokenError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'JsonWebTokenError';
      }
    },
    TokenExpiredError: class extends Error {
      public expiredAt: Date;
      constructor(message: string, expiredAt: Date) {
        super(message);
        this.name = 'TokenExpiredError';
        this.expiredAt = expiredAt;
      }
    }
  };
});

// Create explicit mock factory functions
const createUserRepoMock = () => ({
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  updateLastLogin: jest.fn(),
  verifyEmail: jest.fn(),
  setEmailVerificationToken: jest.fn(),
  findByPasswordResetToken: jest.fn(),
  resetPassword: jest.fn(),
  clearPasswordResetToken: jest.fn(),
  findByEmailVerificationToken: jest.fn(),
  setPasswordResetToken: jest.fn(),
  deleteUser: jest.fn(),
  findAllUsers: jest.fn(),
  listUsersPaginated: jest.fn(),
  findActiveUsers: jest.fn(),
  usernameExists: jest.fn(),
  emailExists: jest.fn(),
  getUserCount: jest.fn(),
  getActiveUserCount: jest.fn(),
  searchUsers: jest.fn(),
  updatePreferences: jest.fn(),
  getUsersByTimezone: jest.fn(),
  incrementFailedLoginAttempts: jest.fn(),
  resetFailedLoginAttempts: jest.fn(),
  lockAccount: jest.fn(),
  addToBlacklist: jest.fn(),
  isTokenBlacklisted: jest.fn(),
});

const createEmailServiceMock = () => ({
  sendEmailVerificationEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  // JWT and crypto are mocked via __mocks__ files

  // Test data
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashed_password123',
    email_verified: true,
    selected_character: 'student',
    character_level: 1,
    experience_points: 0,
    created_at: new Date('2024-01-01'),
    is_active: true,
    is_admin: false,
    preferences: {
      language: 'en',
      theme: 'light'
    }
  };

  const mockRegisterData: RegisterData = {
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'Password123!',
    selectedCharacter: 'student',
    preferences: {
      language: 'en',
      theme: 'light'
    }
  };

  const mockLoginCredentials: LoginCredentials = {
    username: 'testuser',
    password: 'password123'
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock crypto.randomBytes
    jest.spyOn(crypto, 'randomBytes').mockImplementation((size: number) => ({
      toString: jest.fn().mockReturnValue(`mock-token-${size}`)
    } as any));

    // Mock JWT functions directly on the imported module
    (jwt.sign as jest.Mock) = jest.fn((payload: any, secret: string, options?: any) => {
      if (secret.includes('refresh') || options?.expiresIn === '7d') {
        return 'mock-refresh-token';
      } else if (options?.expiresIn === '15m' || secret.includes('jwt')) {
        return 'mock-access-token';
      }
      return 'mock-token';
    });

    (jwt.verify as jest.Mock) = jest.fn((token: string, secret: string, options?: any) => {
      if (token === 'valid-token' || token === 'valid-refresh-token') {
        return {
          userId: 1,
          username: 'testuser',
          email: 'test@example.com',
          selectedCharacter: 'student',
          characterLevel: 1,
          isAdmin: false
        };
      }
      throw new Error('Invalid token');
    });

    // Setup mocks using factory functions
    mockUserRepository = createUserRepoMock() as unknown as jest.Mocked<UserRepository>;
    mockEmailService = createEmailServiceMock() as unknown as jest.Mocked<EmailService>;

    // Create AuthService instance
    authService = new AuthService();
    
    // Replace the private instances with our mocks using type assertion
    (authService as unknown as { userRepository: typeof mockUserRepository }).userRepository = mockUserRepository;
    (authService as unknown as { emailService: typeof mockEmailService }).emailService = mockEmailService;

    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  describe('Password Management', () => {
    describe('hashPassword', () => {
      it('should hash password correctly', async () => {
        const password = 'testpassword';
        const hashedPassword = await authService.hashPassword(password);
        
        expect(hashedPassword).toBe('hashed_testpassword');
      });
    });

    describe('verifyPassword', () => {
      it('should verify correct password', async () => {
        const password = 'testpassword';
        const hash = 'hashed_testpassword';
        
        const result = await authService.verifyPassword(password, hash);
        
        expect(result).toBe(true);
      });

      it('should reject incorrect password', async () => {
        const password = 'wrongpassword';
        const hash = 'hashed_testpassword';
        
        const result = await authService.verifyPassword(password, hash);
        
        expect(result).toBe(false);
      });
    });
  });

  describe('Token Management', () => {
    describe('generateAccessToken', () => {
      it('should generate access token with correct parameters', async () => {
        const tokenPayload: TokenPayload = {
          userId: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          selectedCharacter: mockUser.selected_character,
          characterLevel: mockUser.character_level,
          isAdmin: mockUser.is_admin
        };
        const token = authService.generateAccessToken(tokenPayload);
        
        expect(jwt.sign).toHaveBeenCalledWith(
          tokenPayload,
          'test-jwt-secret',
          {
            expiresIn: '15m',
            issuer: 'learn2play-api',
            audience: 'learn2play-client'
          }
        );
        expect(token).toBe('mock-access-token');
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate refresh token with correct parameters', async () => {
        const tokenPayload: TokenPayload = {
          userId: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          selectedCharacter: mockUser.selected_character,
          characterLevel: mockUser.character_level,
          isAdmin: mockUser.is_admin
        };
        const token = authService.generateRefreshToken(tokenPayload);
        
        expect(jwt.sign).toHaveBeenCalledWith(
          tokenPayload,
          'test-refresh-secret',
          {
            expiresIn: '7d',
            issuer: 'learn2play-api',
            audience: 'learn2play-client'
          }
        );
        expect(token).toBe('mock-refresh-token');
      });
    });

    describe('generateTokens', () => {
      it('should generate both access and refresh tokens', async () => {
        const tokens = authService.generateTokens(mockUser);
        
        expect(tokens).toEqual({
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        });
      });
    });

    describe('verifyAccessToken', () => {
      it('should verify valid access token', async () => {
        const result = authService.verifyAccessToken('valid-token');
        
        expect(jwt.verify).toHaveBeenCalledWith(
          'valid-token',
          'test-jwt-secret',
          {
            issuer: 'learn2play-api',
            audience: 'learn2play-client'
          }
        );
        expect(result).toEqual({
          userId: 1,
          username: 'testuser',
          email: 'test@example.com',
          selectedCharacter: 'student',
          characterLevel: 1,
          isAdmin: false
        });
      });

      it('should throw error for invalid token', async () => {
        expect(() => {
          authService.verifyAccessToken('invalid-token');
        }).toThrow('Token verification failed');
      });
    });

    describe('verifyRefreshToken', () => {
      it('should verify valid refresh token', async () => {
        const result = authService.verifyRefreshToken('valid-refresh-token');
        
        expect(jwt.verify).toHaveBeenCalledWith(
          'valid-refresh-token',
          'test-refresh-secret',
          {
            issuer: 'learn2play-api',
            audience: 'learn2play-client'
          }
        );
        expect(result).toEqual({
          userId: 1,
          username: 'testuser',
          email: 'test@example.com',
          selectedCharacter: 'student',
          characterLevel: 1,
          isAdmin: false
        });
      });

      it('should throw error for invalid refresh token', async () => {
        expect(() => {
          authService.verifyRefreshToken('invalid-token');
        }).toThrow('Refresh token verification failed');
      });
    });
  });

  describe('User Registration', () => {
    describe('register', () => {
      it('should register new user successfully', async () => {
        // Setup mocks
        mockUserRepository.findByUsername.mockResolvedValue(null);
        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockUserRepository.createUser.mockResolvedValue(mockUser);
        mockEmailService.sendEmailVerificationEmail.mockResolvedValue();

        const result = await authService.register(mockRegisterData);

        expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('newuser');
        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('newuser@example.com');
        expect(mockUserRepository.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'newuser',
            email: 'newuser@example.com',
            password_hash: 'hashed_Password123!',
            selected_character: 'student',
            preferences: {
              language: 'en',
              theme: 'light'
            }
          })
        );
        expect(mockEmailService.sendEmailVerificationEmail).toHaveBeenCalledWith(
          'newuser@example.com',
          'newuser',
          expect.any(String)
        );
        expect(result).toEqual({
          user: expect.objectContaining({
            id: 1,
            username: 'testuser',
            email: 'test@example.com'
          }),
          tokens: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
          }
        });
      });

      it('should throw error if username already exists', async () => {
        mockUserRepository.findByUsername.mockResolvedValue(mockUser);

        await expect(authService.register(mockRegisterData)).rejects.toThrow('Username already exists');
        
        expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('newuser');
        expect(mockUserRepository.createUser).not.toHaveBeenCalled();
      });

      it('should throw error if email already exists', async () => {
        mockUserRepository.findByUsername.mockResolvedValue(null);
        mockUserRepository.findByEmail.mockResolvedValue(mockUser);

        await expect(authService.register(mockRegisterData)).rejects.toThrow('Email already exists');
        
        expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('newuser');
        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('newuser@example.com');
        expect(mockUserRepository.createUser).not.toHaveBeenCalled();
      });
    });
  });

  describe('User Login', () => {
    describe('login', () => {
      it('should login user with valid credentials', async () => {
        mockUserRepository.findByUsername.mockResolvedValue(mockUser);
        mockUserRepository.updateLastLogin.mockResolvedValue();

        const result = await authService.login(mockLoginCredentials);

        expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
        expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(1);
        expect(result).toEqual({
          user: expect.objectContaining({
            id: 1,
            username: 'testuser',
            email: 'test@example.com'
          }),
          tokens: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
          }
        });
      });

      it('should throw error for non-existent user', async () => {
        mockUserRepository.findByUsername.mockResolvedValue(null);

        await expect(authService.login(mockLoginCredentials)).rejects.toThrow('Invalid credentials');
        
        expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
        expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
      });

      it('should throw error for deactivated account', async () => {
        const deactivatedUser = { ...mockUser, is_active: false };
        mockUserRepository.findByUsername.mockResolvedValue(deactivatedUser);

        await expect(authService.login(mockLoginCredentials)).rejects.toThrow('Account is deactivated');
        
        expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
      });

      it('should throw error for invalid password', async () => {
        const userWithDifferentPassword = { ...mockUser, password_hash: 'hashed_differentpassword' };
        mockUserRepository.findByUsername.mockResolvedValue(userWithDifferentPassword);

        await expect(authService.login(mockLoginCredentials)).rejects.toThrow('Invalid credentials');
        
        expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
      });

      it('should allow login for unverified email', async () => {
        const unverifiedUser = { ...mockUser, email_verified: false };
        mockUserRepository.findByUsername.mockResolvedValue(unverifiedUser);
        mockUserRepository.updateLastLogin.mockResolvedValue();

        const result = await authService.login(mockLoginCredentials);

        expect(result).toBeDefined();
        expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Token Refresh', () => {
    describe('refreshToken', () => {
      it('should refresh tokens with valid refresh token', async () => {
        mockUserRepository.findUserById.mockResolvedValue(mockUser);

        const result = await authService.refreshToken('valid-refresh-token');

        expect(jwt.verify).toHaveBeenCalledWith(
          'valid-refresh-token',
          'test-refresh-secret',
          { 
            issuer: 'learn2play-api',
            audience: 'learn2play-client'
          }
        );
        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
        expect(result).toEqual({
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        });
      });

      it('should throw error if user not found', async () => {
        mockUserRepository.findUserById.mockResolvedValue(null);

        await expect(authService.refreshToken('valid-refresh-token')).rejects.toThrow('User not found');
        
        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
      });

      it('should throw error if user account is deactivated', async () => {
        const deactivatedUser = { ...mockUser, is_active: false };
        mockUserRepository.findUserById.mockResolvedValue(deactivatedUser);

        await expect(authService.refreshToken('valid-refresh-token')).rejects.toThrow('Account is deactivated');
        
        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Get User by Token', () => {
    describe('getUserByToken', () => {
      it('should return user for valid token', async () => {
        mockUserRepository.findUserById.mockResolvedValue(mockUser);

        const result = await authService.getUserByToken('valid-token');

        expect(jwt.verify).toHaveBeenCalledWith(
          'valid-token',
          'test-jwt-secret',
          { 
            issuer: 'learn2play-api',
            audience: 'learn2play-client'
          }
        );
        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
        expect(result).toEqual(expect.objectContaining({
          id: 1,
          username: 'testuser',
          email: 'test@example.com'
        }));
      });

      it('should return null for invalid token', async () => {
        const result = await authService.getUserByToken('invalid-token');

        expect(result).toBeNull();
        expect(mockUserRepository.findUserById).not.toHaveBeenCalled();
      });

      it('should return null if user not found', async () => {
        mockUserRepository.findUserById.mockResolvedValue(null);

        const result = await authService.getUserByToken('valid-token');

        expect(result).toBeNull();
      });

      it('should return null if user is deactivated', async () => {
        const deactivatedUser = { ...mockUser, is_active: false };
        mockUserRepository.findUserById.mockResolvedValue(deactivatedUser);

        const result = await authService.getUserByToken('valid-token');

        expect(result).toBeNull();
      });
    });
  });

  describe('Password Change', () => {
    describe('changePassword', () => {
      it('should change password successfully', async () => {
        mockUserRepository.findUserById.mockResolvedValue(mockUser);
        mockUserRepository.updateUser.mockResolvedValue(mockUser);

        await authService.changePassword(1, 'password123', 'NewPassword123!');

        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
        expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
          1,
          { password_hash: 'hashed_NewPassword123!' }
        );
      });

      it('should throw error if user not found', async () => {
        mockUserRepository.findUserById.mockResolvedValue(null);

        await expect(authService.changePassword(1, 'password123', 'NewPassword123!')).rejects.toThrow('User not found');
        
        expect(mockUserRepository.updateUser).not.toHaveBeenCalled();
      });

      it('should throw error if current password is incorrect', async () => {
        const userWithDifferentPassword = { ...mockUser, password_hash: 'hashed_differentpassword' };
        mockUserRepository.findUserById.mockResolvedValue(userWithDifferentPassword);

        await expect(authService.changePassword(1, 'wrongpassword', 'NewPassword123!')).rejects.toThrow('Current password is incorrect');
        
        expect(mockUserRepository.updateUser).not.toHaveBeenCalled();
      });
    });
  });

  describe('Email Verification', () => {
    describe('verifyEmail', () => {
      it('should verify email successfully', async () => {
        mockUserRepository.verifyEmail.mockResolvedValue(mockUser);
        mockEmailService.sendWelcomeEmail.mockResolvedValue();

        const result = await authService.verifyEmail('valid-token');

        expect(mockUserRepository.verifyEmail).toHaveBeenCalledWith('valid-token');
        expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(mockUser.email, mockUser.username);
        expect(result).toEqual(mockUser);
      });

      it('should throw error for invalid token', async () => {
        mockUserRepository.verifyEmail.mockResolvedValue(null);

        await expect(authService.verifyEmail('invalid-token')).rejects.toThrow('Invalid or expired verification token');
        
        expect(mockEmailService.sendWelcomeEmail).not.toHaveBeenCalled();
      });
    });

    describe('resendEmailVerification', () => {
      it('should resend verification email successfully', async () => {
        const unverifiedUser = { ...mockUser, email_verified: false };
        mockUserRepository.findByEmail.mockResolvedValue(unverifiedUser);
        mockUserRepository.setEmailVerificationToken.mockResolvedValue();
        mockEmailService.sendEmailVerificationEmail.mockResolvedValue();

        await authService.resendEmailVerification('test@example.com');

        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
        expect(mockUserRepository.setEmailVerificationToken).toHaveBeenCalledWith(
          1,
          expect.any(String),
          expect.any(Date)
        );
        expect(mockEmailService.sendEmailVerificationEmail).toHaveBeenCalledWith(
          'test@example.com',
          'testuser',
          expect.any(String)
        );
      });

      it('should throw error if user not found', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(null);

        await expect(authService.resendEmailVerification('nonexistent@example.com')).rejects.toThrow('User not found');
        
        expect(mockUserRepository.setEmailVerificationToken).not.toHaveBeenCalled();
      });

      it('should throw error if email is already verified', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(mockUser);

        await expect(authService.resendEmailVerification('test@example.com')).rejects.toThrow('Email is already verified');
        
        expect(mockUserRepository.setEmailVerificationToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('Password Reset', () => {
    describe('requestPasswordReset', () => {
      it('should request password reset successfully', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(mockUser);
        mockUserRepository.updateUser.mockResolvedValue(mockUser);
        mockEmailService.sendPasswordResetEmail.mockResolvedValue();

        await authService.requestPasswordReset('test@example.com');

        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
        expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
          'test@example.com',
          'testuser',
          expect.any(String), // temporary password
          expect.any(String)  // reset token
        );
      });

      it('should not reveal if email does not exist', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(null);

        await authService.requestPasswordReset('nonexistent@example.com');

        expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
        expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('should throw error for deactivated account', async () => {
        const deactivatedUser = { ...mockUser, is_active: false };
        mockUserRepository.findByEmail.mockResolvedValue(deactivatedUser);

        await expect(authService.requestPasswordReset('test@example.com')).rejects.toThrow('Account is deactivated');
        
        expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });
    });

    describe('completePasswordReset', () => {
      it('should complete password reset successfully', async () => {
        mockUserRepository.findByPasswordResetToken.mockResolvedValue(mockUser);
        mockUserRepository.resetPassword.mockResolvedValue(mockUser);

        await authService.completePasswordReset('valid-reset-token', 'NewPassword123!');

        expect(mockUserRepository.findByPasswordResetToken).toHaveBeenCalledWith('valid-reset-token');
        expect(mockUserRepository.resetPassword).toHaveBeenCalledWith(
          'valid-reset-token',
          'hashed_NewPassword123!'
        );
      });

      it('should throw error for invalid reset token', async () => {
        mockUserRepository.findByPasswordResetToken.mockResolvedValue(null);

        await expect(authService.completePasswordReset('invalid-token', 'NewPassword123!')).rejects.toThrow('Invalid or expired reset token');
        
        expect(mockUserRepository.resetPassword).not.toHaveBeenCalled();
      });
    });
  });
});