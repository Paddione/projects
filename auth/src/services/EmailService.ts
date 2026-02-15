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
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Shared Cybervault email template wrapper
     */
    private getEmailTemplate(content: string): string {
        return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Korczewski Auth</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: rgba(10, 10, 46, 0.95); border: 1px solid rgba(0, 242, 255, 0.15); border-radius: 12px; overflow: hidden;">
          <!-- Gradient accent line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #00f2ff, #bc13fe);"></td>
          </tr>
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 16px;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="64" height="64">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#00f2ff"/>
                    <stop offset="100%" stop-color="#bc13fe"/>
                  </linearGradient>
                </defs>
                <path d="M40 6L68 18v22c0 14-11 26-28 30C23 66 12 54 12 40V18L40 6z" stroke="url(#g)" stroke-width="2" fill="none"/>
                <circle cx="40" cy="32" r="7" stroke="url(#g)" stroke-width="1.5" fill="none"/>
                <rect x="38.5" y="39" width="3" height="14" fill="url(#g)"/>
                <rect x="41.5" y="46" width="6" height="3" fill="url(#g)"/>
              </svg>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid rgba(0, 242, 255, 0.1); padding: 16px 32px; text-align: center;">
              <span style="font-size: 11px; color: rgba(255,255,255,0.3); letter-spacing: 0.1em; text-transform: uppercase;">Korczewski Auth</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    /**
     * Styled CTA button for emails
     */
    private getButton(text: string, url: string): string {
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
        <tr>
          <td style="background: linear-gradient(135deg, #bc13fe, #00f2ff); border-radius: 8px; padding: 2px;">
            <a href="${url}" target="_blank" style="display: block; background-color: #1a1a4e; border-radius: 6px; padding: 14px 32px; color: #00f2ff; font-weight: 700; font-size: 15px; text-decoration: none; text-align: center; letter-spacing: 0.03em;">${text}</a>
          </td>
        </tr>
      </table>`;
    }

    /**
     * Send verification email
     */
    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const verificationUrl = `${this.appUrl}/verify-email?token=${token}`;

        const content = `
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px; text-align: center;">E-Mail-Bestätigung</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hallo!</p>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Bitte bestätige deine E-Mail-Adresse, indem du auf den Button klickst:</p>
              ${this.getButton('E-Mail bestätigen', verificationUrl)}
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; line-height: 1.5; margin: 16px 0 0; text-align: center;">Dieser Link ist 24 Stunden gültig.</p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.5; margin: 8px 0 0; text-align: center;">Falls du dich nicht registriert hast, ignoriere diese E-Mail.</p>`;

        const mailOptions = {
            from: `"Korczewski Auth" <${this.fromEmail}>`,
            to,
            subject: 'Bestätige deine E-Mail-Adresse',
            html: this.getEmailTemplate(content),
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

        const content = `
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 16px; text-align: center;">Passwort zurücksetzen</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hallo!</p>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Du hast eine Passwort-Zurücksetzung angefordert. Klicke auf den Button, um ein neues Passwort zu wählen:</p>
              ${this.getButton('Passwort zurücksetzen', resetUrl)}
              <p style="color: rgba(255,255,255,0.4); font-size: 13px; line-height: 1.5; margin: 16px 0 0; text-align: center;">Dieser Link ist 1 Stunde gültig.</p>
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.5; margin: 8px 0 0; text-align: center;">Falls du dies nicht angefordert hast, ignoriere diese E-Mail.</p>`;

        const mailOptions = {
            from: `"Korczewski Auth" <${this.fromEmail}>`,
            to,
            subject: 'Setze dein Passwort zurück',
            html: this.getEmailTemplate(content),
        };

        await this.transporter.sendMail(mailOptions);
    }

    /**
     * Send security alert email
     */
    async sendSecurityAlert(to: string, action: string, metadata: any = {}): Promise<void> {
        const time = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'medium' });

        const detailRows = [
            `<tr><td style="color: rgba(255,255,255,0.5); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">Zeitpunkt</td><td style="color: rgba(255,255,255,0.8); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">${time}</td></tr>`,
            metadata.ip ? `<tr><td style="color: rgba(255,255,255,0.5); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">IP-Adresse</td><td style="color: rgba(255,255,255,0.8); font-size: 13px; padding: 6px 12px; border-bottom: 1px solid rgba(0,242,255,0.08);">${metadata.ip}</td></tr>` : '',
            metadata.userAgent ? `<tr><td style="color: rgba(255,255,255,0.5); font-size: 13px; padding: 6px 12px;">Browser</td><td style="color: rgba(255,255,255,0.8); font-size: 13px; padding: 6px 12px;">${metadata.userAgent}</td></tr>` : '',
        ].filter(Boolean).join('');

        const content = `
              <h1 style="color: #ffaa00; font-size: 22px; font-weight: 700; margin: 0 0 16px; text-align: center;">Sicherheitshinweis</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Auf deinem Konto wurde eine sicherheitsrelevante Aktion durchgeführt:</p>
              <p style="color: #00f2ff; font-size: 16px; font-weight: 700; margin: 0 0 20px; padding: 12px; background: rgba(0,242,255,0.05); border: 1px solid rgba(0,242,255,0.15); border-radius: 8px; text-align: center;">${action}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(0,242,255,0.03); border: 1px solid rgba(0,242,255,0.1); border-radius: 8px; margin-bottom: 20px;">
                ${detailRows}
              </table>
              <p style="color: #ff3366; font-size: 14px; font-weight: 600; line-height: 1.5; margin: 0; text-align: center;">Falls du das nicht warst, ändere sofort dein Passwort.</p>`;

        const mailOptions = {
            from: `"Korczewski Auth" <${this.fromEmail}>`,
            to,
            subject: `Sicherheitshinweis: ${action}`,
            html: this.getEmailTemplate(content),
        };

        await this.transporter.sendMail(mailOptions);
    }
}
