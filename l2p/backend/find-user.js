#!/usr/bin/env node

import { UserRepository } from './dist/repositories/UserRepository.js';

async function findUser() {
  try {
    console.log('Finding user with email patrick@korczewski.de...');
    
    const userRepository = new UserRepository();
    
    // Find the user by email
    const user = await userRepository.findByEmail('patrick@korczewski.de');
    if (!user) {
      console.log('No user found with email patrick@korczewski.de');
      return;
    }
    
    console.log('User found:');
    console.log('ID:', user.id);
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('Email Verified:', user.email_verified);
    console.log('Character:', user.selected_character);
    console.log('Level:', user.character_level);
    console.log('Experience:', user.experience_points);
    console.log('Created:', user.created_at);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findUser(); 