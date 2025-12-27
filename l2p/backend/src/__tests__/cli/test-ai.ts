#!/usr/bin/env tsx

import { GeminiService, type QuestionGenerationRequest } from '../../services/GeminiService.js';
// Centralized env loader
import '../../config/env.js';

// Env is loaded by the centralized loader

async function testGeminiConnection() {
  console.log('🔍 Testing Gemini API connection...');
  
  try {
    const geminiService = new GeminiService();
    const result = await geminiService.testConnection();
    
    if (result.success) {
      console.log('✅ Gemini API connection successful');
    } else {
      console.log('❌ Gemini API connection failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error testing Gemini API:', error instanceof Error ? error.message : 'Unknown error');
  }
}



async function testQuestionGeneration() {
  console.log('🔍 Testing question generation...');
  
  try {
    const geminiService = new GeminiService();
    
    const request: QuestionGenerationRequest = {
      topic: 'JavaScript Basics',
      category: 'Programming',
      difficulty: 'easy',
      questionCount: 3,
      language: 'en'
    };
    
    console.log('📝 Generating questions for:', request.topic);
    const result = await geminiService.generateQuestions(request);
    
    if (result.success) {
      console.log('✅ Question generation successful');
      console.log(`📊 Generated ${result.questions.length} questions`);
      console.log('📋 Questions:');
      result.questions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.questionText.en}`);
        console.log(`     Correct: ${q.answers.find(a => a.correct)?.text.en}`);
      });
    } else {
      console.log('❌ Question generation failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error testing question generation:', error instanceof Error ? error.message : 'Unknown error');
  }
}



async function main() {
  const command = process.argv[2];
  
  console.log('🤖 Learn2Play AI Integration Test\n');
  
  switch (command) {
    case 'gemini':
      await testGeminiConnection();
      break;
    case 'generate':
      await testQuestionGeneration();
      break;
    case 'all':
      await testGeminiConnection();
      console.log('');
      await testQuestionGeneration();
      break;
    default:
      console.log('Usage: npm run test:ai <command>');
      console.log('');
      console.log('Commands:');
      console.log('  gemini     - Test Gemini API connection');
      console.log('  generate   - Test question generation');
      console.log('  all        - Run all tests');
      console.log('');
      console.log('Environment variables required:');
      console.log('  GEMINI_API_KEY - Google Gemini API key');
  }
}

main().catch(console.error); 