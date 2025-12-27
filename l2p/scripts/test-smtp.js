#!/usr/bin/env node

/**
 * SMTP Test Script for Learn2Play
 * 
 * This script tests the SMTP configuration by attempting to send test emails.
 * 
 * Usage:
 *   npm run test:smtp                    # Test with mocked SMTP (default)
 *   npm run test:smtp -- --real          # Test with real SMTP credentials
 *   TEST_REAL_SMTP=true npm run test:smtp # Alternative way to enable real SMTP
 */

import { EmailService } from '../backend/src/services/EmailService.ts';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Load environment variables
config({ path: join(rootDir, '.env') });

// Check command line arguments
const args = process.argv.slice(2);
const useRealSmtp = args.includes('--real') || process.env.TEST_REAL_SMTP === 'true';

// Set SMTP configuration based on mode
if (useRealSmtp) {
  console.log('🔧 Using REAL SMTP configuration from environment');
  process.env.TEST_REAL_SMTP = 'true';
  
  // Ensure SMTP credentials are set
  process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  process.env.SMTP_SECURE = process.env.SMTP_SECURE || 'false';
  process.env.SMTP_USER = process.env.SMTP_USER || 'p.korczewski@gmail.com';
  process.env.SMTP_PASS = process.env.SMTP_PASS || 'mxbd2kfpnqwer8st';
  process.env.EMAIL_SENDER_ADDRESS = process.env.EMAIL_SENDER_ADDRESS || 'noreply@l2p.korczewski.de';
  process.env.EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'Learn2Play';
} else {
  console.log('🔧 Using MOCKED SMTP configuration for testing');
  process.env.TEST_REAL_SMTP = 'false';
  
  // Set mock values
  process.env.SMTP_HOST = 'smtp.test.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'test@example.com';
  process.env.SMTP_PASS = 'testpassword';
  process.env.EMAIL_SENDER_ADDRESS = 'noreply@test.com';
  process.env.EMAIL_SENDER_NAME = 'Test Platform';
}

async function testSmtpConfiguration() {
  console.log('\n📧 SMTP Configuration Test');
  console.log('===========================');
  
  // Display configuration (hide password)
  console.log(`Host: ${process.env.SMTP_HOST}`);
  console.log(`Port: ${process.env.SMTP_PORT}`);
  console.log(`Secure: ${process.env.SMTP_SECURE}`);
  console.log(`User: ${process.env.SMTP_USER}`);
  console.log(`Pass: ${'*'.repeat((process.env.SMTP_PASS || '').length)}`);
  console.log(`Sender Address: ${process.env.EMAIL_SENDER_ADDRESS}`);
  console.log(`Sender Name: ${process.env.EMAIL_SENDER_NAME}`);
  console.log(`Real SMTP: ${useRealSmtp ? 'YES' : 'NO'}`);
  
  try {
    const emailService = new EmailService();
    
    console.log('\n🔍 Testing SMTP Connection...');
    const connectionResult = await emailService.testConnectionDetailed();
    
    if (connectionResult.success) {
      console.log('✅ SMTP connection successful!');
      
      if (useRealSmtp) {
        console.log('\n📬 Sending test emails...');
        
        // Test email address (using your Gmail for real tests)
        const testEmail = 'p.korczewski@gmail.com';
        const testUsername = 'SMTPTestUser';
        
        try {
          console.log('📧 Sending welcome email...');
          await emailService.sendWelcomeEmail(testEmail, testUsername);
          console.log('✅ Welcome email sent successfully!');
          
          console.log('📧 Sending password reset email...');
          await emailService.sendPasswordResetEmail(testEmail, testUsername, 'temp123456', 'test-token-123');
          console.log('✅ Password reset email sent successfully!');
          
          console.log('📧 Sending email verification email...');
          await emailService.sendEmailVerificationEmail(testEmail, testUsername, 'verify-token-123');
          console.log('✅ Email verification email sent successfully!');
          
          console.log('\n🎉 All test emails sent successfully!');
          console.log(`📬 Check your inbox at: ${testEmail}`);
          
        } catch (emailError) {
          console.error('❌ Error sending test emails:', emailError.message);
          process.exit(1);
        }
      } else {
        console.log('ℹ️ Skipping email sending tests (using mocked SMTP)');
        console.log('💡 To test real email sending, run with --real flag');
      }
      
    } else {
      console.error('❌ SMTP connection failed!');
      console.error('Error:', connectionResult.error);
      if (connectionResult.details) {
        console.error('Details:', connectionResult.details);
      }
      
      if (useRealSmtp) {
        console.log('\n🔧 Troubleshooting tips:');
        console.log('- Check if Gmail App Password is correct');
        console.log('- Verify 2FA is enabled on Gmail account');
        console.log('- Ensure "Less secure app access" is disabled (use App Password instead)');
        console.log('- Check network connectivity and firewall settings');
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testSmtpConfiguration().then(() => {
  console.log('\n✅ SMTP test completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ SMTP test failed:', error);
  process.exit(1);
});
