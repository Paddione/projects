#!/usr/bin/env node

import { AuthService } from './dist/services/AuthService.js';
import { UserRepository } from './dist/repositories/UserRepository.js';

async function createUser() {
  try {
    console.log('Creating user Patrick...');
    
    const authService = new AuthService();
    const userRepository = new UserRepository();
    
    // Check if user already exists
    const existingUser = await userRepository.findByUsername('Patrick');
    if (existingUser) {
      console.log('User Patrick already exists!');
      return;
    }
    
    const existingEmail = await userRepository.findByEmail('patrick@korczewski.de');
    if (existingEmail) {
      console.log('Email patrick@korczewski.de already exists!');
      return;
    }
    
    // Create user data
    const userData = {
      username: 'Patrick',
      email: 'patrick@korczewski.de',
      password: 'Plotterpapier3!$',
      selectedCharacter: 'professor', // Choose professor avatar
      preferences: {
        language: 'en',
        theme: 'light'
      }
    };
    
    // Register the user
    const result = await authService.register(userData);
    
    // Manually verify the email and set level to 1
    await userRepository.updateUser(result.user.id, {
      email_verified: true,
      character_level: 1,
      experience_points: 0
    });
    
    console.log('✅ User Patrick created successfully!');
    console.log('Username: Patrick');
    console.log('Email: patrick@korczewski.de');
    console.log('Password: Plotterpapier3!$');
    console.log('Avatar: Professor');
    console.log('Level: 1');
    console.log('Email Verified: Yes');
    
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    process.exit(1);
  }
}

createUser(); 