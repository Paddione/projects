export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  selected_character: string;
  character_level: number;
  experience_points: number;
  created_at: Date;
  is_active: boolean;
  is_admin: boolean;
  preferences: {
    language: 'en' | 'de';
    theme: 'light' | 'dark';
  };
  last_login?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  email_verification_token?: string;
  email_verification_expires?: Date;
  avatar_url?: string;
  timezone?: string;
  notification_settings?: {
    email: boolean;
    push: boolean;
  };
  failed_login_attempts?: number;
  last_failed_login?: Date;
  account_locked_until?: Date;
  current_session_id?: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  selectedCharacter?: string;
  preferences?: {
    language: 'en' | 'de';
    theme: 'light' | 'dark';
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}
