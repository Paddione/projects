import request from 'supertest';
import { app } from '../../server.js';

const API_BASE = '/api/questions';

async function testQuestionAPI() {
  console.log('🚀 Testing Question Management API...\n');

  try {
    // Test 1: Get question statistics
    console.log('1. Testing question statistics...');
    const statsResponse = await request(app)
      .get(`${API_BASE}/stats`)
      .expect(200);
    
    console.log('✅ Question stats:', statsResponse.body.data);

    // Test 2: Get available categories
    console.log('\n2. Testing available categories...');
    const categoriesResponse = await request(app)
      .get(`${API_BASE}/categories`)
      .expect(200);
    
    console.log('✅ Available categories:', categoriesResponse.body.data);

    // Test 3: Get all question sets
    console.log('\n3. Testing get all question sets...');
    const questionSetsResponse = await request(app)
      .get(`${API_BASE}/sets`)
      .expect(200);
    
    console.log('✅ Question sets count:', questionSetsResponse.body.data.length);

    // Test 4: Create a test question set
    console.log('\n4. Testing create question set...');
    const createSetData = {
      name: 'Test Question Set',
      description: 'A test question set for API testing',
      category: 'Test',
      difficulty: 'medium',
      is_active: true
    };

    const createSetResponse = await request(app)
      .post(`${API_BASE}/sets`)
      .send(createSetData)
      .expect(201);
    
    const questionSetId = createSetResponse.body.data.id;
    console.log('✅ Created question set with ID:', questionSetId);

    // Test 5: Get question set by ID
    console.log('\n5. Testing get question set by ID...');
    const getSetResponse = await request(app)
      .get(`${API_BASE}/sets/${questionSetId}`)
      .expect(200);
    
    console.log('✅ Retrieved question set:', getSetResponse.body.data.name);

    // Test 6: Create a test question
    console.log('\n6. Testing create question...');
    const createQuestionData = {
      question_set_id: questionSetId,
      question_text: {
        en: 'What is the capital of France?',
        de: 'Was ist die Hauptstadt von Frankreich?'
      },
      answers: [
        {
          text: {
            en: 'Paris',
            de: 'Paris'
          },
          correct: true
        },
        {
          text: {
            en: 'London',
            de: 'London'
          },
          correct: false
        },
        {
          text: {
            en: 'Berlin',
            de: 'Berlin'
          },
          correct: false
        },
        {
          text: {
            en: 'Madrid',
            de: 'Madrid'
          },
          correct: false
        }
      ],
      explanation: {
        en: 'Paris is the capital and largest city of France.',
        de: 'Paris ist die Hauptstadt und größte Stadt Frankreichs.'
      },
      difficulty: 1
    };

    const createQuestionResponse = await request(app)
      .post(`${API_BASE}/`)
      .send(createQuestionData)
      .expect(201);
    
    const questionId = createQuestionResponse.body.data.id;
    console.log('✅ Created question with ID:', questionId);

    // Test 7: Get question by ID with localization
    console.log('\n7. Testing get question with localization...');
    const getQuestionEnResponse = await request(app)
      .get(`${API_BASE}/${questionId}?lang=en`)
      .expect(200);
    
    console.log('✅ English question:', getQuestionEnResponse.body.data.questionText);

    const getQuestionDeResponse = await request(app)
      .get(`${API_BASE}/${questionId}?lang=de`)
      .expect(200);
    
    console.log('✅ German question:', getQuestionDeResponse.body.data.questionText);

    // Test 8: Get questions by set ID
    console.log('\n8. Testing get questions by set ID...');
    const getQuestionsResponse = await request(app)
      .get(`${API_BASE}/sets/${questionSetId}/questions?lang=en`)
      .expect(200);
    
    console.log('✅ Questions in set:', getQuestionsResponse.body.data.length);

    // Test 9: Get random questions
    console.log('\n9. Testing get random questions...');
    const randomQuestionsData = {
      questionSetIds: [questionSetId],
      count: 1
    };

    const randomQuestionsResponse = await request(app)
      .post(`${API_BASE}/random?lang=en`)
      .send(randomQuestionsData)
      .expect(200);
    
    console.log('✅ Random questions count:', randomQuestionsResponse.body.data.length);

    // Test 10: Search questions
    console.log('\n10. Testing search questions...');
    const searchResponse = await request(app)
      .get(`${API_BASE}/search?q=capital&lang=en`)
      .expect(200);
    
    console.log('✅ Search results count:', searchResponse.body.data.length);

    // Test 11: Update question set
    console.log('\n11. Testing update question set...');
    const updateSetData = {
      name: 'Updated Test Question Set',
      description: 'Updated description'
    };

    const updateSetResponse = await request(app)
      .put(`${API_BASE}/sets/${questionSetId}`)
      .send(updateSetData)
      .expect(200);
    
    console.log('✅ Updated question set:', updateSetResponse.body.data.name);

    // Test 12: Update question
    console.log('\n12. Testing update question...');
    const updateQuestionData = {
      question_text: {
        en: 'What is the capital of France? (Updated)',
        de: 'Was ist die Hauptstadt von Frankreich? (Aktualisiert)'
      },
      difficulty: 2
    };

    const updateQuestionResponse = await request(app)
      .put(`${API_BASE}/${questionId}`)
      .send(updateQuestionData)
      .expect(200);
    
    console.log('✅ Updated question difficulty:', updateQuestionResponse.body.data.difficulty);

    // Test 13: Delete question
    console.log('\n13. Testing delete question...');
    await request(app)
      .delete(`${API_BASE}/${questionId}`)
      .expect(200);
    
    console.log('✅ Question deleted successfully');

    // Test 14: Delete question set
    console.log('\n14. Testing delete question set...');
    await request(app)
      .delete(`${API_BASE}/sets/${questionSetId}`)
      .expect(200);
    
    console.log('✅ Question set deleted successfully');

    // Test 15: Error handling - invalid ID
    console.log('\n15. Testing error handling...');
    await request(app)
      .get(`${API_BASE}/999999`)
      .expect(404);
    
    console.log('✅ 404 error for non-existent question');

    await request(app)
      .get(`${API_BASE}/sets/999999`)
      .expect(404);
    
    console.log('✅ 404 error for non-existent question set');

    console.log('\n🎉 All Question Management API tests passed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Question Management API test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testQuestionAPI();
} 