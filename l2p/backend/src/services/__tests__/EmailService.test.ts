import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { EmailService } from '../EmailService';
import nodemailer from 'nodemailer';

// Do not use static jest.mock for nodemailer in ESM; we'll spy on createTransport in beforeEach

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;
  let mockCreateTransport: jest.MockedFunction<typeof nodemailer.createTransport>;
  let createTransportSpy: jest.SpiedFunction<typeof nodemailer.createTransport>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock environment variables
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'testpassword';
    process.env.EMAIL_SENDER_ADDRESS = 'noreply@learn2play.com';
    process.env.EMAIL_SENDER_NAME = 'Learn2Play Platform';

    // Mock transporter methods
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    } as any;

    // Spy on nodemailer.createTransport in ESM
    createTransportSpy = jest.spyOn(nodemailer as any, 'createTransport');
    mockCreateTransport = createTransportSpy as unknown as jest.MockedFunction<typeof nodemailer.createTransport>;
    createTransportSpy.mockReturnValue(mockTransporter as any);

    // Create EmailService instance
    emailService = new EmailService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_SENDER_ADDRESS;
    delete process.env.EMAIL_SENDER_NAME;
    if (createTransportSpy) createTransportSpy.mockRestore();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration when env vars are missing', () => {
      // Clear environment variables
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;

      const service = new EmailService();

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'testpassword'
        }
      });
    });

    it('should not initialize transporter when credentials are missing', () => {
      // Clear all environment variables first
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_SECURE;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.EMAIL_SENDER_ADDRESS;
      delete process.env.EMAIL_SENDER_NAME;

      // Clear the mock to reset call count
      jest.clearAllMocks();

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

      new EmailService();

      expect(consoleSpy).toHaveBeenCalledWith('Gmail SMTP credentials not configured - email functionality will be disabled');
      expect(mockCreateTransport).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle transporter initialization errors', () => {
      mockCreateTransport.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      new EmailService();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Gmail SMTP transporter:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should log successful initialization', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

      new EmailService();

      expect(consoleSpy).toHaveBeenCalledWith('Gmail SMTP transporter initialized successfully');

      consoleSpy.mockRestore();
    });
  });

  describe('Email Template Rendering and Localization', () => {
    describe('Welcome Email Template', () => {
      it('should generate welcome email template with correct bilingual content', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

        await emailService.sendWelcomeEmail('user@example.com', 'testuser');

        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
          from: '"Learn2Play Platform" <noreply@learn2play.com>',
          to: 'user@example.com',
          subject: 'Willkommen bei Learn2Play! / Welcome to Learn2Play!',
          text: expect.stringContaining('Deutsch:'),
          html: expect.stringContaining('Willkommen, testuser!')
        });

        const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

        // Check German content
        expect(callArgs.html).toContain('Willkommen, testuser!');
        expect(callArgs.html).toContain('Vielen Dank für deine Registrierung bei Learn2Play!');
        expect(callArgs.html).toContain('Benutzername:</strong> testuser');

        // Check English content
        expect(callArgs.html).toContain('Welcome, testuser!');
        expect(callArgs.html).toContain('Thank you for registering with Learn2Play!');
        expect(callArgs.html).toContain('Username:</strong> testuser');

        // Check text version
        expect(callArgs.text).toContain('Deutsch:');
        expect(callArgs.text).toContain('English:');
        expect(callArgs.text).toContain('Benutzername: testuser');
        expect(callArgs.text).toContain('Username: testuser');
      });

      it('should include proper HTML structure and styling', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

        await emailService.sendWelcomeEmail('user@example.com', 'testuser');

        const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

        expect(callArgs.html).toContain('<!DOCTYPE html>');
        expect(callArgs.html).toContain('<meta charset="utf-8">');
        expect(callArgs.html).toContain('font-family: Arial, sans-serif');
        expect(callArgs.html).toContain('background: #4F46E5');
        expect(callArgs.html).toContain('class="button"');
        expect(callArgs.html).toContain('https://l2p.korczewski.de');
      });
    });

    describe('Password Reset Email Template', () => {
      it('should generate password reset email with temporary password', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

        await emailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', "reset-token");

        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
          from: '"Learn2Play Platform" <noreply@learn2play.com>',
          to: 'user@example.com',
          subject: 'Passwort zurücksetzen / Password Reset - Learn2Play',
          text: expect.stringContaining('temp123!'),
          html: expect.stringContaining('temp123!')
        });

        const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

        // Check temporary password is displayed
        expect(callArgs.html).toContain('temp123!');
        expect(callArgs.text).toContain('temp123!');

        // Check warning messages
        expect(callArgs.html).toContain('Du musst dieses Passwort beim ersten Login ändern!');
        expect(callArgs.html).toContain('You must change this password on your first login!');

        // Check password box styling
        expect(callArgs.html).toContain('class="password-box"');
        expect(callArgs.html).toContain('class="warning"');
      });

      it('should include security warnings in both languages', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

        await emailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', "reset-token");

        const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

        // German warnings
        expect(callArgs.html).toContain('⚠️ Wichtig:');
        expect(callArgs.text).toContain('⚠️ Wichtig:');
        expect(callArgs.html).toContain('Falls du diese E-Mail nicht angefordert hast');

        // English warnings
        expect(callArgs.html).toContain('⚠️ Important:');
        expect(callArgs.text).toContain('⚠️ Important:');
        expect(callArgs.html).toContain('If you didn\'t request this email');
      });
    });

    describe('URL Resolution for Email Links', () => {
      it('should use localhost URL in development environment', async () => {
        // Set environment to development
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        // Clear any existing URL environment variables
        delete process.env.APP_BASE_URL;
        delete process.env.FRONTEND_BASE_URL;

        try {
          mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

          // Create new EmailService instance to pick up environment changes
          const devEmailService = new EmailService();

          await devEmailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', 'reset-token');

          const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

          // Check that localhost URL is used in development
          const expectedUrl = 'http://localhost:3000/reset-password?token=reset-token';
          expect(callArgs.html).toContain(expectedUrl);
          expect(callArgs.text).toContain(expectedUrl);
        } finally {
          // Restore original environment
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should use production URL in production environment', async () => {
        // Set environment to production
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        // Clear any existing URL environment variables
        delete process.env.APP_BASE_URL;
        delete process.env.FRONTEND_BASE_URL;

        try {
          mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

          // Create new EmailService instance to pick up environment changes
          const prodEmailService = new EmailService();

          await prodEmailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', 'reset-token');

          const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

          // Check that production URL is used
          const expectedUrl = 'https://l2p.korczewski.de/reset-password?token=reset-token';
          expect(callArgs.html).toContain(expectedUrl);
          expect(callArgs.text).toContain(expectedUrl);
        } finally {
          // Restore original environment
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should prioritize APP_BASE_URL when set', async () => {
        // Set explicit APP_BASE_URL
        const originalAppUrl = process.env.APP_BASE_URL;
        const originalEnv = process.env.NODE_ENV;
        process.env.APP_BASE_URL = 'http://custom.localhost:4000';
        process.env.NODE_ENV = 'development';

        try {
          mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

          // Create new EmailService instance to pick up environment changes
          const customEmailService = new EmailService();

          await customEmailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', 'reset-token');

          const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

          // Check that custom URL is used
          const expectedUrl = 'http://custom.localhost:4000/reset-password?token=reset-token';
          expect(callArgs.html).toContain(expectedUrl);
          expect(callArgs.text).toContain(expectedUrl);
        } finally {
          // Restore original environment
          if (originalAppUrl) {
            process.env.APP_BASE_URL = originalAppUrl;
          } else {
            delete process.env.APP_BASE_URL;
          }
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should prioritize FRONTEND_BASE_URL when APP_BASE_URL is not set', async () => {
        // Set explicit FRONTEND_BASE_URL
        const originalFrontendUrl = process.env.FRONTEND_BASE_URL;
        const originalEnv = process.env.NODE_ENV;
        delete process.env.APP_BASE_URL;
        process.env.FRONTEND_BASE_URL = 'http://frontend.localhost:5000';
        process.env.NODE_ENV = 'development';

        try {
          mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

          // Create new EmailService instance to pick up environment changes
          const customEmailService = new EmailService();

          await customEmailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', 'reset-token');

          const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

          // Check that frontend URL is used
          const expectedUrl = 'http://frontend.localhost:5000/reset-password?token=reset-token';
          expect(callArgs.html).toContain(expectedUrl);
          expect(callArgs.text).toContain(expectedUrl);
        } finally {
          // Restore original environment
          if (originalFrontendUrl) {
            process.env.FRONTEND_BASE_URL = originalFrontendUrl;
          } else {
            delete process.env.FRONTEND_BASE_URL;
          }
          process.env.NODE_ENV = originalEnv;
        }
      });
    });

    describe('Email Verification Template', () => {
      it('should generate email verification template with token', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

        await emailService.sendEmailVerificationEmail('user@example.com', 'testuser', 'verify-token-123');

        expect(mockTransporter.sendMail).toHaveBeenCalledWith({
          from: '"Learn2Play Platform" <noreply@learn2play.com>',
          to: 'user@example.com',
          subject: 'E-Mail bestätigen / Verify Email - Learn2Play',
          text: expect.stringContaining('verify-token-123'),
          html: expect.stringContaining('verify-token-123')
        });

        const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

        // Check verification URL is properly constructed
        const expectedUrl = 'https://l2p.korczewski.de/verify-email?token=verify-token-123';
        expect(callArgs.html).toContain(expectedUrl);
        expect(callArgs.text).toContain(expectedUrl);

        // Check bilingual content
        expect(callArgs.html).toContain('Bitte bestätige deine E-Mail-Adresse');
        expect(callArgs.html).toContain('Please verify your email address');
      });

      it('should include fallback link instructions', async () => {
        mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

        await emailService.sendEmailVerificationEmail('user@example.com', 'testuser', 'verify-token-123');

        const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

        expect(callArgs.html).toContain('Falls der Button nicht funktioniert');
        expect(callArgs.html).toContain('If the button doesn\'t work');
        expect(callArgs.html).toContain('kopiere diesen Link in deinen Browser');
        expect(callArgs.html).toContain('copy this link to your browser');
      });
    });
  });

  describe('Email Sending Success and Failure Scenarios', () => {
    describe('Successful Email Sending', () => {
      it('should send welcome email successfully', async () => {
        const mockResult = { messageId: 'welcome-message-123' };
        mockTransporter.sendMail.mockResolvedValue(mockResult);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        await emailService.sendWelcomeEmail('user@example.com', 'testuser');

        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Email sent successfully to user@example.com. Message ID: welcome-message-123');

        consoleSpy.mockRestore();
      });

      it('should send password reset email successfully', async () => {
        const mockResult = { messageId: 'reset-message-456' };
        mockTransporter.sendMail.mockResolvedValue(mockResult);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        await emailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', "reset-token");

        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Email sent successfully to user@example.com. Message ID: reset-message-456');

        consoleSpy.mockRestore();
      });

      it('should send email verification successfully', async () => {
        const mockResult = { messageId: 'verify-message-789' };
        mockTransporter.sendMail.mockResolvedValue(mockResult);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        await emailService.sendEmailVerificationEmail('user@example.com', 'testuser', 'verify-token');

        expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Email sent successfully to user@example.com. Message ID: verify-message-789');

        consoleSpy.mockRestore();
      });
    });

    describe('Email Sending Failures', () => {
      it('should handle SMTP connection errors', async () => {
        const smtpError = new Error('SMTP connection failed');
        mockTransporter.sendMail.mockRejectedValue(smtpError);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        await expect(emailService.sendWelcomeEmail('user@example.com', 'testuser'))
          .rejects.toThrow('Failed to send email: SMTP connection failed');

        expect(consoleSpy).toHaveBeenCalledWith('Email sending error:', smtpError);

        consoleSpy.mockRestore();
      });

      it('should handle authentication errors', async () => {
        const authError = new Error('Authentication failed');
        mockTransporter.sendMail.mockRejectedValue(authError);

        await expect(emailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', "reset-token"))
          .rejects.toThrow('Failed to send email: Authentication failed');
      });

      it('should handle invalid recipient errors', async () => {
        const recipientError = new Error('Invalid recipient address');
        mockTransporter.sendMail.mockRejectedValue(recipientError);

        await expect(emailService.sendEmailVerificationEmail('invalid-email', 'testuser', 'token'))
          .rejects.toThrow('Failed to send email: Invalid recipient address');
      });

      it('should handle unknown errors gracefully', async () => {
        mockTransporter.sendMail.mockRejectedValue('Unknown error string');

        await expect(emailService.sendWelcomeEmail('user@example.com', 'testuser'))
          .rejects.toThrow('Failed to send email: Unknown error');
      });

      it('should handle rate limiting errors', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        mockTransporter.sendMail.mockRejectedValue(rateLimitError);

        await expect(emailService.sendWelcomeEmail('user@example.com', 'testuser'))
          .rejects.toThrow('Failed to send email: Rate limit exceeded');
      });
    });

    describe('Disabled Email Service', () => {
      let emailServiceDisabled: EmailService;

      beforeEach(() => {
        // Remove credentials to disable email service
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;

        emailServiceDisabled = new EmailService();
      });

      it('should log warning when sending welcome email with disabled service', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

        await emailServiceDisabled.sendWelcomeEmail('user@example.com', 'testuser');

        expect(consoleSpy).toHaveBeenCalledWith(
          'Email sending disabled - would have sent email to user@example.com with subject: Willkommen bei Learn2Play! / Welcome to Learn2Play!'
        );
        expect(mockTransporter.sendMail).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should log warning when sending password reset with disabled service', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

        await emailServiceDisabled.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', "reset-token");

        expect(consoleSpy).toHaveBeenCalledWith(
          'Email sending disabled - would have sent email to user@example.com with subject: Passwort zurücksetzen / Password Reset - Learn2Play'
        );

        consoleSpy.mockRestore();
      });

      it('should log warning when sending verification email with disabled service', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

        await emailServiceDisabled.sendEmailVerificationEmail('user@example.com', 'testuser', 'token');

        expect(consoleSpy).toHaveBeenCalledWith(
          'Email sending disabled - would have sent email to user@example.com with subject: E-Mail bestätigen / Verify Email - Learn2Play'
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Connection Testing', () => {
    describe('testConnection', () => {
      it('should return true for successful connection test', async () => {
        mockTransporter.verify.mockResolvedValue(true);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        const result = await emailService.testConnection();

        expect(result).toBe(true);
        expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Gmail SMTP connection test successful');

        consoleSpy.mockRestore();
      });

      it('should return false for failed connection test', async () => {
        const connectionError = new Error('Connection failed');
        mockTransporter.verify.mockRejectedValue(connectionError);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const result = await emailService.testConnection();

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith('Gmail SMTP connection test failed:', connectionError);

        consoleSpy.mockRestore();
      });

      it('should return false when email service is not configured', async () => {
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;

        const emailServiceDisabled = new EmailService();
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

        const result = await emailServiceDisabled.testConnection();

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith('Email service not configured - test skipped');
        expect(mockTransporter.verify).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('testConnectionDetailed', () => {
      it('should return success details for successful connection', async () => {
        mockTransporter.verify.mockResolvedValue(true);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });

        const result = await emailService.testConnectionDetailed();

        expect(result).toEqual({ success: true });
        expect(consoleSpy).toHaveBeenCalledWith('Gmail SMTP detailed connection test successful');

        consoleSpy.mockRestore();
      });

      it('should return error details for failed connection', async () => {
        const connectionError = new Error('Detailed connection failed');
        mockTransporter.verify.mockRejectedValue(connectionError);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const result = await emailService.testConnectionDetailed();

        expect(result).toEqual({
          success: false,
          error: 'Detailed connection failed',
          details: connectionError
        });
        expect(consoleSpy).toHaveBeenCalledWith('Gmail SMTP detailed connection test failed:', connectionError);

        consoleSpy.mockRestore();
      });

      it('should return configuration error when service is not configured', async () => {
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;

        const emailServiceDisabled = new EmailService();

        const result = await emailServiceDisabled.testConnectionDetailed();

        expect(result).toEqual({
          success: false,
          error: 'Email service not configured - Gmail SMTP credentials missing',
          details: { configured: false }
        });
        expect(mockTransporter.verify).not.toHaveBeenCalled();
      });

      it('should handle unknown error types', async () => {
        mockTransporter.verify.mockRejectedValue('Unknown error string');
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const result = await emailService.testConnectionDetailed();

        expect(result).toEqual({
          success: false,
          error: 'Unknown error',
          details: 'Unknown error string'
        });

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Email Content Validation', () => {
    it('should handle potentially dangerous HTML in user data', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailService.sendWelcomeEmail('user@example.com', '<script>alert("xss")</script>');

      const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

      // Username should be included as-is (EmailService doesn't escape HTML, which is expected)
      expect(callArgs.html).toContain('<script>alert("xss")</script>');
      // And should be plain in text version
      expect(callArgs.text).toContain('<script>alert("xss")</script>');
    });

    it('should handle special characters in usernames', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailService.sendWelcomeEmail('user@example.com', 'üser_näme-123');

      const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

      expect(callArgs.html).toContain('üser_näme-123');
      expect(callArgs.text).toContain('üser_näme-123');
    });

    it('should handle empty or undefined usernames gracefully', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      await emailService.sendWelcomeEmail('user@example.com', '');

      const callArgs = mockTransporter.sendMail.mock.calls[0]![0];

      expect(callArgs.html).toContain('Willkommen, !');
      expect(callArgs.text).toContain('Benutzername: ');
    });
  });

  describe('Rate Limiting and Retry Logic', () => {
    it('should handle rate limiting errors appropriately', async () => {
      const rateLimitError = new Error('Rate limit exceeded - too many requests');
      mockTransporter.sendMail.mockRejectedValue(rateLimitError);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      await expect(emailService.sendWelcomeEmail('user@example.com', 'testuser'))
        .rejects.toThrow('Failed to send email: Rate limit exceeded - too many requests');

      expect(consoleSpy).toHaveBeenCalledWith('Email sending error:', rateLimitError);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should handle temporary service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      mockTransporter.sendMail.mockRejectedValue(serviceError);

      await expect(emailService.sendPasswordResetEmail('user@example.com', 'testuser', 'temp123!', "reset-token"))
        .rejects.toThrow('Failed to send email: Service temporarily unavailable');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      mockTransporter.sendMail.mockRejectedValue(timeoutError);

      await expect(emailService.sendEmailVerificationEmail('user@example.com', 'testuser', 'token'))
        .rejects.toThrow('Failed to send email: Network timeout');
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Daily sending quota exceeded');
      mockTransporter.sendMail.mockRejectedValue(quotaError);

      await expect(emailService.sendWelcomeEmail('user@example.com', 'testuser'))
        .rejects.toThrow('Failed to send email: Daily sending quota exceeded');
    });
  });

  describe('Email Configuration Edge Cases', () => {
    it('should handle secure SMTP configuration', () => {
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_PORT = '465';

      new EmailService();

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 465,
        secure: true,
        auth: {
          user: 'test@example.com',
          pass: 'testpassword'
        }
      });
    });

    it('should handle custom sender configuration', () => {
      process.env.EMAIL_SENDER_ADDRESS = 'custom@example.com';
      process.env.EMAIL_SENDER_NAME = 'Custom Sender';

      const service = new EmailService();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      service.sendWelcomeEmail('user@example.com', 'testuser');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Custom Sender" <custom@example.com>'
        })
      );
    });

    it('should handle invalid port configuration', () => {
      process.env.SMTP_PORT = 'invalid';

      new EmailService();

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: NaN
        })
      );
    });
  });
});