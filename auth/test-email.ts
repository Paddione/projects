import 'dotenv/config';
import { EmailService } from './src/services/EmailService.js';

async function testEmail() {
  console.log('Testing email configuration...\n');

  console.log('SMTP Configuration:');
  console.log('- Host:', process.env.SMTP_HOST);
  console.log('- Port:', process.env.SMTP_PORT);
  console.log('- Secure:', process.env.SMTP_SECURE);
  console.log('- User:', process.env.SMTP_USER);
  console.log('- From:', process.env.SMTP_FROM);
  console.log('- Pass:', process.env.SMTP_PASS ? '***configured***' : 'NOT SET');
  console.log('- APP_URL:', process.env.APP_URL);
  console.log();

  const emailService = new EmailService();

  try {
    console.log('Sending test verification email...');
    await emailService.sendVerificationEmail(
      process.env.SMTP_USER || 'test@example.com',
      'test-token-12345'
    );
    console.log('✓ Verification email sent successfully!');
  } catch (error) {
    console.error('✗ Failed to send verification email:');
    console.error(error);
    process.exit(1);
  }

  try {
    console.log('\nSending test password reset email...');
    await emailService.sendPasswordResetEmail(
      process.env.SMTP_USER || 'test@example.com',
      'reset-token-67890'
    );
    console.log('✓ Password reset email sent successfully!');
  } catch (error) {
    console.error('✗ Failed to send password reset email:');
    console.error(error);
    process.exit(1);
  }

  try {
    console.log('\nSending test security alert email...');
    await emailService.sendSecurityAlert(
      process.env.SMTP_USER || 'test@example.com',
      'Test Security Action',
      { ip: '127.0.0.1', userAgent: 'Test Agent' }
    );
    console.log('✓ Security alert email sent successfully!');
  } catch (error) {
    console.error('✗ Failed to send security alert email:');
    console.error(error);
    process.exit(1);
  }

  console.log('\n✓ All email tests passed!');
  console.log('Check your inbox at:', process.env.SMTP_USER);
}

testEmail();
