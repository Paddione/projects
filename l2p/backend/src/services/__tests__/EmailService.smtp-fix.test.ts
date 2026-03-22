import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { EmailService } from '../EmailService';

// Mock nodemailer
vi.mock('nodemailer', () => ({
    createTransporter: vi.fn(),
}));

describe('EmailService SMTP Error Handling', () => {
    let emailService: EmailService;
    let consoleSpy: vi.SpyInstance;

    beforeEach(() => {
        // Mock environment variables for SMTP
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_SECURE = 'false';
        process.env.SMTP_USER = 'test@gmail.com';
        process.env.SMTP_PASS = 'testapppassword123';
        process.env.EMAIL_SENDER_ADDRESS = 'noreply@test.com';
        process.env.EMAIL_SENDER_NAME = 'Test Platform';

        // Spy on console methods
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        emailService = new EmailService();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        vi.clearAllMocks();
    });

    describe('Enhanced SMTP Error Messages', () => {
        it('should provide helpful error message for 535 authentication error', async () => {
            // Mock transporter with authentication error
            const mockTransporter = {
                sendMail: vi.fn().mockRejectedValue(
                    new Error('Invalid login: 535-5.7.8 Username and Password not accepted')
                ),
            };

            // @ts-ignore - Access private property for testing
            emailService['transporter'] = mockTransporter;

            try {
                await emailService.sendWelcomeEmail('test@example.com', 'testuser');
            } catch (error) {
                // Verify the error was thrown
                expect(error).toBeInstanceOf(Error);
            }

            // Verify enhanced error messages were logged
            expect(consoleSpy).toHaveBeenCalledWith('Email sending error:', expect.any(Error));
            expect(consoleSpy).toHaveBeenCalledWith('\n🚨 SMTP Authentication Failed!');
            expect(consoleSpy).toHaveBeenCalledWith('📋 This usually means the Gmail App Password is invalid or expired.');
            expect(consoleSpy).toHaveBeenCalledWith('💡 Run "npm run smtp:fix" to diagnose and fix this issue.');
        });

        it('should provide helpful error message for ENOTFOUND connection error', async () => {
            // Mock transporter with connection error
            const mockTransporter = {
                sendMail: vi.fn().mockRejectedValue(
                    new Error('getaddrinfo ENOTFOUND smtp.gmail.com')
                ),
            };

            // @ts-ignore - Access private property for testing
            emailService['transporter'] = mockTransporter;

            try {
                await emailService.sendPasswordResetEmail('test@example.com', 'testuser', 'temp123', 'token123');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
            }

            // Verify enhanced error messages were logged
            expect(consoleSpy).toHaveBeenCalledWith('\n🚨 SMTP Connection Failed!');
            expect(consoleSpy).toHaveBeenCalledWith('📋 Cannot reach Gmail SMTP server. Check your internet connection.');
        });

        it('should provide helpful error message for ECONNREFUSED error', async () => {
            // Mock transporter with connection refused error
            const mockTransporter = {
                sendMail: vi.fn().mockRejectedValue(
                    new Error('connect ECONNREFUSED 74.125.28.108:587')
                ),
            };

            // @ts-ignore - Access private property for testing
            emailService['transporter'] = mockTransporter;

            try {
                await emailService.sendEmailVerificationEmail('test@example.com', 'testuser', 'verify123');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
            }

            // Verify enhanced error messages were logged
            expect(consoleSpy).toHaveBeenCalledWith('\n🚨 SMTP Connection Refused!');
            expect(consoleSpy).toHaveBeenCalledWith('📋 Gmail SMTP server refused connection. Check port and security settings.');
        });

        it('should handle unknown errors gracefully', async () => {
            // Mock transporter with unknown error
            const mockTransporter = {
                sendMail: vi.fn().mockRejectedValue(
                    new Error('Some unknown SMTP error')
                ),
            };

            // @ts-ignore - Access private property for testing
            emailService['transporter'] = mockTransporter;

            try {
                await emailService.sendWelcomeEmail('test@example.com', 'testuser');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain('Failed to send email: Some unknown SMTP error');
            }

            // Should log the error but not the enhanced messages
            expect(consoleSpy).toHaveBeenCalledWith('Email sending error:', expect.any(Error));
            expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('🚨'));
        });
    });

    describe('No Transporter Configuration', () => {
        it('should warn when SMTP is disabled but not throw error', async () => {
            // Create EmailService without credentials to disable transporter
            delete process.env.SMTP_USER;
            delete process.env.SMTP_PASS;

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const disabledEmailService = new EmailService();

            // Should not throw error, just warn
            await expect(
                disabledEmailService.sendWelcomeEmail('test@example.com', 'testuser')
            ).resolves.toBeUndefined();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Email sending disabled - would have sent email to test@example.com')
            );

            warnSpy.mockRestore();
        });
    });
});
