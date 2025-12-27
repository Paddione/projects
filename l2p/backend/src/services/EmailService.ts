import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  senderEmail: string;
  senderName: string;
}

interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export class EmailService {
  private transporter?: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    const smtpPassword = process.env['SMTP_PASS'] || '';

    this.config = {
      host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
      port: parseInt(process.env['SMTP_PORT'] || '587'),
      secure: process.env['SMTP_SECURE'] === 'true',
      user: process.env['SMTP_USER'] || '',
      pass: smtpPassword,
      senderEmail: process.env['EMAIL_SENDER_ADDRESS'] || '',
      senderName: process.env['EMAIL_SENDER_NAME'] || 'Learn2Play Platform'
    };

    if (!this.config.user || !this.config.pass) {
      console.warn('Gmail SMTP credentials not configured - email functionality will be disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        }
      });

      console.log('Gmail SMTP transporter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gmail SMTP transporter:', error);
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    const template = this.getWelcomeTemplate(username);
    await this.sendEmail(to, template);
  }

  /**
   * Send password reset email with temporary password
   */
  async sendPasswordResetEmail(to: string, username: string, temporaryPassword: string, resetToken: string): Promise<void> {
    const template = this.getPasswordResetTemplate(username, temporaryPassword, resetToken);
    await this.sendEmail(to, template);
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(to: string, username: string, verificationToken: string): Promise<void> {
    const template = this.getEmailVerificationTemplate(username, verificationToken);
    await this.sendEmail(to, template);
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    if (!this.transporter) {
      console.warn(`Email sending disabled - would have sent email to ${to} with subject: ${template.subject}`);
      return;
    }

    try {
      const mailOptions = {
        from: `"${this.config.senderName}" <${this.config.senderEmail}>`,
        to: to,
        subject: template.subject,
        text: template.textContent,
        html: template.htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}. Message ID: ${result.messageId}`);
    } catch (error) {
      console.error('Email sending error:', error);
      
      // Enhanced error handling for common SMTP issues
      if (error instanceof Error) {
        if (error.message.includes('535')) {
          console.error('\n🚨 SMTP Authentication Failed!');
          console.error('📋 This usually means the Gmail App Password is invalid or expired.');
          console.error('💡 Run "npm run smtp:fix" to diagnose and fix this issue.');
        } else if (error.message.includes('ENOTFOUND')) {
          console.error('\n🚨 SMTP Connection Failed!');
          console.error('📋 Cannot reach Gmail SMTP server. Check your internet connection.');
        } else if (error.message.includes('ECONNREFUSED')) {
          console.error('\n🚨 SMTP Connection Refused!');
          console.error('📋 Gmail SMTP server refused connection. Check port and security settings.');
        }
      }
      
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve the base URL for links included in emails.
   * Prefers APP_BASE_URL, then FRONTEND_BASE_URL, and falls back based on environment.
   * In development mode, defaults to localhost to make password reset work locally.
   */
  private getAppBaseUrl(): string {
    // Check if we have explicit URL configuration
    if (process.env['APP_BASE_URL']) {
      return (process.env['APP_BASE_URL'] as string).replace(/\/$/, '');
    }

    if (process.env['FRONTEND_BASE_URL']) {
      return (process.env['FRONTEND_BASE_URL'] as string).replace(/\/$/, '');
    }

    // Smart fallback based on environment
    if (process.env['NODE_ENV'] === 'development') {
      // In development, default to localhost for password reset functionality
      return 'http://localhost:3000';
    }

    // Production fallback
    return 'https://l2p.korczewski.de';
  }

  /**
   * Welcome email template
   */
  private getWelcomeTemplate(username: string): EmailTemplate {
    return {
      subject: 'Willkommen bei Learn2Play! / Welcome to Learn2Play!',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; color: #666; }
            .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Learn2Play</h1>
              <p>Multiplayer Quiz Platform</p>
            </div>
            <div class="content">
              <h2>Willkommen, ${username}! / Welcome, ${username}!</h2>
              
              <p><strong>Deutsch:</strong></p>
              <p>Vielen Dank für deine Registrierung bei Learn2Play! Dein Account wurde erfolgreich erstellt.</p>
              <p><strong>Benutzername:</strong> ${username}</p>
              <p>Du kannst jetzt Lobbys erstellen, Freunde einladen und spannende Quiz-Spiele spielen!</p>
              
              <hr style="margin: 30px 0;">
              
              <p><strong>English:</strong></p>
              <p>Thank you for registering with Learn2Play! Your account has been successfully created.</p>
              <p><strong>Username:</strong> ${username}</p>
              <p>You can now create lobbies, invite friends, and play exciting quiz games!</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="https://l2p.korczewski.de" class="button">Jetzt spielen / Start Playing</a>
              </p>
            </div>
            <div class="footer">
              <p>Learn2Play Platform - Multiplayer Quiz Gaming</p>
              <p>Diese E-Mail wurde automatisch generiert. / This email was automatically generated.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
Willkommen bei Learn2Play! / Welcome to Learn2Play!

Deutsch:
Vielen Dank für deine Registrierung bei Learn2Play! Dein Account wurde erfolgreich erstellt.
Benutzername: ${username}
Du kannst jetzt Lobbys erstellen, Freunde einladen und spannende Quiz-Spiele spielen!

English:
Thank you for registering with Learn2Play! Your account has been successfully created.
Username: ${username}
You can now create lobbies, invite friends, and play exciting quiz games!

Besuche: https://l2p.korczewski.de
Visit: https://l2p.korczewski.de

Learn2Play Platform - Multiplayer Quiz Gaming
Diese E-Mail wurde automatisch generiert. / This email was automatically generated.
      `
    };
  }  /**

   * Password reset email template
   */
  private getPasswordResetTemplate(username: string, temporaryPassword: string, resetToken: string): EmailTemplate {
    const resetUrl = `${this.getAppBaseUrl()}/reset-password?token=${resetToken}`;
    return {
      subject: 'Passwort zurücksetzen / Password Reset - Learn2Play',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; color: #666; }
            .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
            .password-box { background: #fff; border: 2px solid #4F46E5; padding: 15px; margin: 20px 0; text-align: center; font-family: monospace; font-size: 18px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Learn2Play</h1>
              <p>Passwort zurücksetzen / Password Reset</p>
            </div>
            <div class="content">
              <h2>Hallo ${username}! / Hello ${username}!</h2>
              
              <p><strong>Account-Name / Account name:</strong> ${username}</p>
              
              <p><strong>Deutsch:</strong></p>
              <p>Du hast eine Passwort-Zurücksetzung für deinen Learn2Play Account angefordert.</p>
              <p>Hier ist dein temporäres Passwort (für einmalige Anmeldung):</p>
              
              <div class="password-box">
                ${temporaryPassword}
              </div>
              
              <div class="warning">
                <strong>⚠️ Wichtig:</strong> Du musst dieses Passwort beim ersten Login ändern!
              </div>

              <p style="margin-top: 20px;">
                <strong>Reset-Token (für Formular-Eingabe):</strong>
              </p>
              <div class="password-box">
                ${resetToken}
              </div>
              
              <hr style="margin: 30px 0;">
              
              <p><strong>English:</strong></p>
              <p>You have requested a password reset for your Learn2Play account.</p>
              <p>Here is your temporary password (for one-time login):</p>
              
              <div class="password-box">
                ${temporaryPassword}
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> You must change this password on your first login!
              </div>

              <p style="margin-top: 20px;">
                <strong>Reset token (for form input):</strong>
              </p>
              <div class="password-box">
                ${resetToken}
              </div>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="button">Passwort jetzt zurücksetzen / Reset Password Now</a>
              </p>
            </div>
            <div class="footer">
              <p>Learn2Play Platform - Multiplayer Quiz Gaming</p>
              <p>Falls du diese E-Mail nicht angefordert hast, ignoriere sie bitte.</p>
              <p>If you didn't request this email, please ignore it.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
Passwort zurücksetzen / Password Reset - Learn2Play

Hallo ${username}! / Hello ${username}!

Account-Name / Account name: ${username}

Deutsch:
Du hast eine Passwort-Zurücksetzung für deinen Learn2Play Account angefordert.
 Hier ist dein temporäres Passwort (für einmalige Anmeldung): ${temporaryPassword}
 Reset-Token (für Formular): ${resetToken}

⚠️ Wichtig: Du musst dieses Passwort beim ersten Login ändern!

English:
You have requested a password reset for your Learn2Play account.
 Here is your temporary password (for one-time login): ${temporaryPassword}
 Reset token (for form): ${resetToken}

⚠️ Important: You must change this password on your first login!

 Reset Password: ${resetUrl}

Learn2Play Platform - Multiplayer Quiz Gaming
Falls du diese E-Mail nicht angefordert hast, ignoriere sie bitte.
If you didn't request this email, please ignore it.
      `
    };
  }

  /**
   * Email verification template
   */
  private getEmailVerificationTemplate(username: string, verificationToken: string): EmailTemplate {
    const verificationUrl = `${this.getAppBaseUrl()}/verify-email?token=${verificationToken}`;

    return {
      subject: 'E-Mail bestätigen / Verify Email - Learn2Play',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; color: #666; }
            .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Learn2Play</h1>
              <p>E-Mail Bestätigung / Email Verification</p>
            </div>
            <div class="content">
              <h2>Hallo ${username}! / Hello ${username}!</h2>
              
              <p><strong>Deutsch:</strong></p>
              <p>Bitte bestätige deine E-Mail-Adresse, um deinen Learn2Play Account zu aktivieren.</p>
              <p>Klicke auf den Button unten, um deine E-Mail zu bestätigen:</p>
              
              <hr style="margin: 30px 0;">
              
              <p><strong>English:</strong></p>
              <p>Please verify your email address to activate your Learn2Play account.</p>
              <p>Click the button below to verify your email:</p>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" class="button">E-Mail bestätigen / Verify Email</a>
              </p>
              
              <p style="font-size: 12px; color: #666;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                If the button doesn't work, copy this link to your browser:<br>
                ${verificationUrl}
              </p>
            </div>
            <div class="footer">
              <p>Learn2Play Platform - Multiplayer Quiz Gaming</p>
              <p>Diese E-Mail wurde automatisch generiert. / This email was automatically generated.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      textContent: `
E-Mail bestätigen / Verify Email - Learn2Play

Hallo ${username}! / Hello ${username}!

Deutsch:
Bitte bestätige deine E-Mail-Adresse, um deinen Learn2Play Account zu aktivieren.
Bestätigungslink: ${verificationUrl}

English:
Please verify your email address to activate your Learn2Play account.
Verification link: ${verificationUrl}

Learn2Play Platform - Multiplayer Quiz Gaming
Diese E-Mail wurde automatisch generiert. / This email was automatically generated.
      `
    };
  }

  /**
   * Test email connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service not configured - test skipped');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('Gmail SMTP connection test successful');
      return true;
    } catch (error) {
      console.error('Gmail SMTP connection test failed:', error);
      return false;
    }
  }

  /**
   * Test email connectivity with detailed error reporting
   */
  async testConnectionDetailed(): Promise<{ success: boolean, error?: string, details?: any }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not configured - Gmail SMTP credentials missing',
        details: { configured: false }
      };
    }

    try {
      await this.transporter.verify();
      console.log('Gmail SMTP detailed connection test successful');
      return { success: true };
    } catch (error) {
      console.error('Gmail SMTP detailed connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };
    }
  }
}

export const emailService = new EmailService();
