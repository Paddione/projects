import { HallOfFameService } from '../../services/HallOfFameService.js';
import { HallOfFameRepository } from '../../repositories/HallOfFameRepository.js';
import { GameSessionRepository } from '../../repositories/GameSessionRepository.js';
import { QuestionRepository } from '../../repositories/QuestionRepository.js';

async function testHallOfFameSystem() {
  console.log('🧪 Testing Hall of Fame System...\n');

  const hallOfFameService = new HallOfFameService();
  const hallOfFameRepo = new HallOfFameRepository();
  const gameSessionRepo = new GameSessionRepository();
  const questionRepo = new QuestionRepository();

  try {
    // Test 1: Create test question sets
    console.log('📝 Creating test question sets...');
    const questionSet1 = await questionRepo.createQuestionSet({
      name: 'General Knowledge',
      description: 'General knowledge questions',
      difficulty: 'medium',
      is_active: true
    });
    const questionSet2 = await questionRepo.createQuestionSet({
      name: 'Science Quiz',
      description: 'Science-related questions',
      difficulty: 'hard',
      is_active: true
    });
    console.log('✅ Test question sets created');

    // Test 2: Create test game sessions
    console.log('\n🎮 Creating test game sessions...');
    const session1 = await gameSessionRepo.createGameSession({
      lobby_id: 1,
      question_set_id: questionSet1.id,
      total_questions: 10
    });
    const session2 = await gameSessionRepo.createGameSession({
      lobby_id: 2,
      question_set_id: questionSet2.id,
      total_questions: 15
    });
    console.log('✅ Test game sessions created');

    // Test 3: Submit scores to Hall of Fame
    console.log('\n🏆 Submitting scores to Hall of Fame...');
    
    const submissions = [
      {
        sessionId: session1.id,
        username: 'Alice',
        characterName: 'Warrior',
        score: 850,
        accuracy: 90,
        maxMultiplier: 4,
        questionSetId: questionSet1.id,
        questionSetName: questionSet1.name
      },
      {
        sessionId: session2.id,
        username: 'Bob',
        characterName: 'Mage',
        score: 1200,
        accuracy: 95,
        maxMultiplier: 5,
        questionSetId: questionSet2.id,
        questionSetName: questionSet2.name
      },
      {
        sessionId: session1.id,
        username: 'Charlie',
        characterName: 'Archer',
        score: 750,
        accuracy: 85,
        maxMultiplier: 3,
        questionSetId: questionSet1.id,
        questionSetName: questionSet1.name
      },
      {
        sessionId: session2.id,
        username: 'Diana',
        characterName: 'Paladin',
        score: 1100,
        accuracy: 92,
        maxMultiplier: 4,
        questionSetId: questionSet2.id,
        questionSetName: questionSet2.name
      }
    ];

    for (const submission of submissions) {
      try {
        const entry = await hallOfFameService.submitScore(submission);
        console.log(`✅ Score submitted for ${submission.username}: ${submission.score} points`);
      } catch (error) {
        console.log(`⚠️  Could not submit score for ${submission.username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Test 4: Get leaderboards
    console.log('\n📊 Testing leaderboard retrieval...');
    
    // Get leaderboard for question set 1
    const leaderboard1 = await hallOfFameService.getQuestionSetLeaderboard(questionSet1.id, 10);
    console.log(`\n🏆 Leaderboard for "${leaderboard1.questionSetName}":`);
    leaderboard1.entries.forEach((entry: any, index: number) => {
      const medal = entry.medal ? `🥇${entry.medal.toUpperCase()}🥇` : '';
      console.log(`${index + 1}. ${entry.username} (${entry.character_name || 'Unknown'}) - ${entry.score} pts (${entry.accuracy}% accuracy, ${entry.max_multiplier}x multiplier) ${medal}`);
    });

    // Get leaderboard for question set 2
    const leaderboard2 = await hallOfFameService.getQuestionSetLeaderboard(questionSet2.id, 10);
    console.log(`\n🏆 Leaderboard for "${leaderboard2.questionSetName}":`);
    leaderboard2.entries.forEach((entry: any, index: number) => {
      const medal = entry.medal ? `🥇${entry.medal.toUpperCase()}🥇` : '';
      console.log(`${index + 1}. ${entry.username} (${entry.character_name || 'Unknown'}) - ${entry.score} pts (${entry.accuracy}% accuracy, ${entry.max_multiplier}x multiplier) ${medal}`);
    });

    // Test 5: Get all leaderboards
    console.log('\n📈 Getting all leaderboards...');
    const allLeaderboards = await hallOfFameService.getAllLeaderboards();
    console.log(`✅ Retrieved ${Object.keys(allLeaderboards).length} leaderboards`);

    // Test 6: Get user best scores
    console.log('\n👤 Testing user best scores...');
    const aliceBestScores = await hallOfFameService.getUserBestScores('Alice');
    console.log(`\n🏆 Alice's best scores:`);
    aliceBestScores.forEach((score: any) => {
      console.log(`- ${score.question_set_name}: ${score.score} pts (${score.accuracy}% accuracy)`);
    });

    // Test 7: Get user rank
    console.log('\n📊 Testing user rank retrieval...');
    const aliceRank = await hallOfFameService.getUserRankInQuestionSet('Alice', questionSet1.id);
    console.log(`Alice's rank in "${questionSet1.name}": ${aliceRank || 'Not ranked'}`);

    // Test 8: Get recent entries
    console.log('\n🕒 Testing recent entries...');
    const recentEntries = await hallOfFameService.getRecentEntries(5);
    console.log(`\n📝 Recent Hall of Fame entries:`);
    recentEntries.forEach((entry: any, index: number) => {
      console.log(`${index + 1}. ${entry.username} - ${entry.score} pts in ${entry.question_set_name} (${entry.completed_at.toLocaleDateString()})`);
    });

    // Test 9: Get statistics
    console.log('\n📊 Testing statistics...');
    const statistics = await hallOfFameService.getStatistics();
    console.log(`\n📈 Hall of Fame Statistics:`);
    console.log(`- Total entries: ${statistics.totalEntries}`);
    console.log(`- Unique players: ${statistics.uniquePlayers}`);
    console.log(`- Average score: ${statistics.averageScore.toFixed(2)}`);
    console.log(`- Highest score: ${statistics.highestScore}`);
    console.log(`- Average accuracy: ${statistics.averageAccuracy.toFixed(2)}%`);

    // Test 10: Search entries
    console.log('\n🔍 Testing search functionality...');
    const searchResults = await hallOfFameService.searchEntries('Alice', 10);
    console.log(`\n🔍 Search results for "Alice":`);
    searchResults.forEach((entry: any, index: number) => {
      console.log(`${index + 1}. ${entry.username} - ${entry.score} pts in ${entry.question_set_name}`);
    });

    // Test 11: Validate eligibility
    console.log('\n✅ Testing eligibility validation...');
    const eligibility = await hallOfFameService.validateEligibility(session1.id);
    console.log(`\n📋 Eligibility for session ${session1.id}:`);
    console.log(`- Is eligible: ${eligibility.isEligible}`);
    console.log(`- Reason: ${eligibility.reason || 'N/A'}`);
    console.log(`- Completion rate: ${(eligibility.completionRate * 100).toFixed(1)}%`);
    console.log(`- Total questions: ${eligibility.totalQuestions}`);
    console.log(`- Completed questions: ${eligibility.completedQuestions}`);

    console.log('\n🎉 All Hall of Fame tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during Hall of Fame testing:', error);
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    try {
      const entries = await hallOfFameRepo.getRecentEntries(50);
      for (const entry of entries) {
        if (entry.username === 'Alice' || entry.username === 'Bob' || entry.username === 'Charlie' || entry.username === 'Diana') {
          await hallOfFameRepo.deleteEntry(entry.id);
        }
      }
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('⚠️  Error during cleanup:', error);
    }
  }
}

// Run the test
testHallOfFameSystem().catch(console.error); 