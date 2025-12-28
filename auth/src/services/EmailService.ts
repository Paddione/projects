import nodemailer from 'nodemailer';

export class EmailService {
    private transporter: nodemailer.Transporter;
    private fromEmail: string;
    private appUrl: string;

    constructor() {
        this.fromEmail = process.env.SMTP_FROM || 'noreply@korczewski.de';
        this.appUrl = process.env.APP_URL || 'http://localhost:3000';

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Send verification email
     */
    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const verificationUrl = `${this.appUrl}/verify-email?token=${token}`;

        const mailOptions = {
            from: `"Unified Auth" <${this.fromEmail}>`,
            to,
            subject: 'Verify your email background',
            html: `
        <h1>Email Verification</h1>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
      `,
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

        const mailOptions = {
            from: `"Unified Auth" <${this.fromEmail}>`,
            to,
            subject: 'Password Reset Request',
            html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * Send security alert email
     */
    async sendSecurityAlert(to: string, action: string, metadata: any = {}): Promise<void> {
        const mailOptions = {
            from: `"Unified Auth Security" <${this.fromEmail}>`,
            to,
            subject: `Security Alert: ${action}`,
            html: `
        <h1>Security Alert</h1>
        <p>Important security-related action occurred on your account: <strong>${action}</strong></p>
        <p>Details:</p>
        <ul>
          <li>Time: ${new Date().toISOString()}</li>
          ${metadata.ip ? `<li>IP Address: ${metadata.ip}</li>` : ''}
          ${metadata.userAgent ? `<li>User Agent: ${metadata.userAgent}</li>` : ''}
        </ul>
        <p>If this was not you, please contact support or change your password immediately.</p>
      `,
        };

        await this.transporter.sendMail(mailOptions);
    }
}
