#!/usr/bin/env node

import { UserRepository } from './dist/repositories/UserRepository.js';
import { AuthService } from './dist/services/AuthService.js';

async function checkAndUpdateUser() {
  try {
    console.log('Checking user Patrick...');
    
    const userRepository = new UserRepository();
    const authService = new AuthService();
    
    // Find the user
    const user = await userRepository.findByUsername('Patrick');
    if (!user) {
      console.log('User Patrick not found!');
      return;
    }
    
    console.log('Current user details:');
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('Email Verified:', user.email_verified);
    console.log('Character:', user.selected_character);
    console.log('Level:', user.character_level);
    console.log('Experience:', user.experience_points);
    
    // Check if we need to update anything
    const needsUpdate = !user.email_verified || 
                       user.selected_character !== 'professor' || 
                       user.character_level !== 1;
    
    if (needsUpdate) {
      console.log('\nUpdating user details...');
      
      await userRepository.updateUser(user.id, {
        email_verified: true,
        selected_character: 'professor',
        character_level: 1,
        experience_points: 0
      });
      
      console.log('✅ User updated successfully!');
    } else {
      console.log('\n✅ User is already correctly configured!');
    }
    
    console.log('\nFinal user details:');
    const updatedUser = await userRepository.findByUsername('Patrick');
    console.log('Username:', updatedUser.username);
    console.log('Email:', updatedUser.email);
    console.log('Email Verified:', updatedUser.email_verified);
    console.log('Character:', updatedUser.selected_character);
    console.log('Level:', updatedUser.character_level);
    console.log('Experience:', updatedUser.experience_points);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAndUpdateUser(); 