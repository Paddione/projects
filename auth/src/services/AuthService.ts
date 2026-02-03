import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { users, type User, type NewUser } from '../db/schema.js';
import { eq, or, sql, and } from 'drizzle-orm';
import { TokenService } from './TokenService.js';
import { EmailService } from './EmailService.js';
import type { LoginCredentials, RegisterData, AuthResult, SafeUser } from '../types/auth.js';

/**
 * Strip sensitive internal fields from a user record.
 * Uses an allowlist so new columns are hidden by default.
 */
function sanitizeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    avatar_url: user.avatar_url,
    timezone: user.timezone,
    role: user.role,
    selected_character: user.selected_character,
    character_level: user.character_level,
    experience_points: user.experience_points,
    preferences: user.preferences,
    notification_settings: user.notification_settings,
    email_verified: user.email_verified,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login: user.last_login,
  };
}

export class AuthService {
  private tokenService: TokenService;
  private emailService: EmailService;
  private readonly SALT_ROUNDS: number;
  private readonly MAX_LOGIN_ATTEMPTS: number;
  private readonly LOCKOUT_DURATION: number; // in milliseconds
  private readonly PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour
  private readonly EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.tokenService = new TokenService();
    this.emailService = new EmailService();
    this.SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    this.MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
    this.LOCKOUT_DURATION = parseInt(process.env.ACCOUNT_LOCKOUT_DURATION || '900000', 10); // 15 min default
  }

  /**
   * Hash a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash || typeof hash !== 'string' || hash.length === 0) {
      return false;
    }
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if account is locked
   */
  private async isAccountLocked(user: User): Promise<boolean> {
    if (!user.account_locked_until) {
      return false;
    }

    const now = new Date();
    if (user.account_locked_until > now) {
      return true;
    }

    // Lock expired, reset failed attempts
    await db
      .update(users)
      .set({
        failed_login_attempts: 0,
        account_locked_until: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    return false;
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(userId: number): Promise<void> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (user.length === 0) return;

    const failedAttempts = (user[0].failed_login_attempts || 0) + 1;
    const now = new Date();

    const updates: Partial<NewUser> = {
      failed_login_attempts: failedAttempts,
      last_failed_login: now,
      updated_at: now,
    };

    // Lock account if max attempts reached
    if (failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      updates.account_locked_until = new Date(Date.now() + this.LOCKOUT_DURATION);
    }

    await db.update(users).set(updates).where(eq(users.id, userId));
  }

  /**
   * Handle successful login
   */
  private async handleSuccessfulLogin(userId: number): Promise<void> {
    await db
      .update(users)
      .set({
        failed_login_attempts: 0,
        account_locked_until: null,
        last_login: new Date(),
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResult> {
    // Validate password
    const passwordValidation = this.validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Check if email already exists (case-insensitive)
    const existingEmail = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${data.email})`)
      .limit(1);

    if (existingEmail.length > 0) {
      throw new Error('Email already registered');
    }

    // Check if username already exists (case-insensitive)
    const existingUsername = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${data.username})`)
      .limit(1);

    if (existingUsername.length > 0) {
      throw new Error('Username already taken');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + this.EMAIL_VERIFICATION_EXPIRY);

    // Create user
    const newUser: NewUser = {
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(), // Enforce lowercase username
      password_hash: passwordHash,
      name: data.name,
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires,
      email_verified: false,
      role: 'USER',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [createdUser] = await db.insert(users).values(newUser).returning();

    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(createdUser.email, verificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // We don't fail registration if email fails, but in production we might want to queue it
    }

    // Generate tokens
    const tokens = this.tokenService.generateTokens(createdUser);

    return {
      user: sanitizeUser(createdUser),
      tokens,
    };
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Find user by username or email (case-insensitive)
    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = LOWER(${credentials.usernameOrEmail})`,
          sql`LOWER(${users.email}) = LOWER(${credentials.usernameOrEmail})`
        )
      )
      .limit(1);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (await this.isAccountLocked(user)) {
      const lockoutMinutes = Math.ceil(this.LOCKOUT_DURATION / 60000);
      throw new Error(`Account locked. Try again in ${lockoutMinutes} minutes.`);
    }

    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    if (!user.password_hash) {
      throw new Error('This account uses OAuth. Please sign in with Google.');
    }

    const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);

    if (!isValidPassword) {
      await this.handleFailedLogin(user.id);
      throw new Error('Invalid credentials');
    }

    // Successful login
    await this.handleSuccessfulLogin(user.id);

    // Generate tokens
    const tokens = this.tokenService.generateTokens(user);

    return {
      user: sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<boolean> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email_verification_token, token),
          sql`${users.email_verification_expires} > NOW()`
        )
      )
      .limit(1);

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await db
      .update(users)
      .set({
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    return true;
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.email_verified) {
      throw new Error('Email is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + this.EMAIL_VERIFICATION_EXPIRY);

    await db
      .update(users)
      .set({
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    await this.emailService.sendVerificationEmail(user.email, verificationToken);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`)
      .limit(1);

    if (!user) {
      // Don't reveal if email exists
      return 'If the email exists, a password reset link has been sent';
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + this.PASSWORD_RESET_EXPIRY);

    await db
      .update(users)
      .set({
        password_reset_token: resetToken,
        password_reset_expires: resetExpires,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }

    return 'If the email exists, a password reset link has been sent';
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Validate new password
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.password_reset_token, token),
          sql`${users.password_reset_expires} > NOW()`
        )
      )
      .limit(1);

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await db
      .update(users)
      .set({
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
        account_locked_until: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    // Send security alert
    try {
      await this.emailService.sendSecurityAlert(user.email, 'Password Reset Success');
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }

    return true;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<SafeUser | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return null;
    }

    return sanitizeUser(user);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`)
      .limit(1);

    return user || null;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: number,
    updates: Partial<Pick<User, 'name' | 'avatar_url' | 'timezone' | 'preferences' | 'notification_settings'>>
  ): Promise<SafeUser> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return sanitizeUser(updatedUser);
  }

  /**
   * Change password (when user is already authenticated)
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.password_hash) {
      throw new Error('User not found or OAuth account');
    }

    // Verify current password
    const isValid = await this.verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    const passwordHash = await this.hashPassword(newPassword);

    await db
      .update(users)
      .set({
        password_hash: passwordHash,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Send security alert
    try {
      await this.emailService.sendSecurityAlert(user.email, 'Password Changed');
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }

    return true;
  }
}
