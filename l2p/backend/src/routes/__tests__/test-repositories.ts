import { DatabaseService } from '../../services/DatabaseService.js';
import { UserRepository } from '../../repositories/UserRepository.js';
import { LobbyRepository } from '../../repositories/LobbyRepository.js';
import { QuestionRepository } from '../../repositories/QuestionRepository.js';
import { GameSessionRepository } from '../../repositories/GameSessionRepository.js';
import { HallOfFameRepository } from '../../repositories/HallOfFameRepository.js';

const db = DatabaseService.getInstance();

async function testRepositories() {
    console.log('🔧 Testing all repository implementations...');

    try {
        // Test User Repository
        console.log('1. Testing User Repository...');
        const userRepo = new UserRepository();
        const timestamp = Date.now();
        const testUser = await userRepo.createUser({
            username: `testuser_repo_${timestamp}`,
            email: `test_repo_${timestamp}@example.com`,
            password_hash: 'hashed_password_123',
            preferences: {
                language: 'en',
                theme: 'dark'
            }
        });
        console.log('✅ User created:', testUser.username);

        // Test Lobby Repository
        console.log('2. Testing Lobby Repository...');
        const lobbyRepo = new LobbyRepository();
        const testLobby = await lobbyRepo.createLobby({
            code: `REPO${timestamp.toString().slice(-6)}`,
            host_id: testUser.id,
            question_count: 15
        });
        console.log('✅ Lobby created with code:', testLobby.code);

        // Test adding player to lobby
        await lobbyRepo.addPlayerToLobby(testLobby.id, {
            id: 'player1',
            username: 'player1',
            character: 'char1',
            isReady: false
        });
        console.log('✅ Player added to lobby');

        // Test Question Repository
        console.log('3. Testing Question Repository...');
        const questionRepo = new QuestionRepository();
        const questionSets = await questionRepo.findAllQuestionSets();
        console.log('✅ Found question sets:', questionSets.length);
        
        if (questionSets.length > 0 && questionSets[0]) {
            const questions = await questionRepo.findQuestionsBySetId(questionSets[0].id);
            console.log('✅ Found questions in first set:', questions.length);
            
            if (questions.length > 0) {
                const randomQuestions = await questionRepo.getRandomQuestions([questionSets[0].id], 2);
                console.log('✅ Retrieved random questions:', randomQuestions.length);
            }
        }

        // Test Game Session Repository
        console.log('4. Testing Game Session Repository...');
        const gameSessionRepo = new GameSessionRepository();
        const testSession = await gameSessionRepo.createGameSession({
            lobby_id: testLobby.id,
            question_set_id: questionSets.length > 0 && questionSets[0] ? questionSets[0].id : 1,
            total_questions: 5
        });
        console.log('✅ Game session created with ID:', testSession.id);

        // Test Player Result
        const testPlayerResult = await gameSessionRepo.createPlayerResult({
            session_id: testSession.id,
            user_id: testUser.id,
            username: testUser.username,
            character_name: 'TestChar',
            final_score: 180,
            correct_answers: 4,
            total_questions: 5,
            max_multiplier: 4,
            completion_time: 90,
            answer_details: [
                {
                    questionId: 1,
                    selectedAnswer: 'A',
                    isCorrect: true,
                    timeElapsed: 15,
                    pointsEarned: 45,
                    multiplierUsed: 1
                },
                {
                    questionId: 2,
                    selectedAnswer: 'B',
                    isCorrect: true,
                    timeElapsed: 20,
                    pointsEarned: 80,
                    multiplierUsed: 2
                }
            ]
        });
        console.log('✅ Player result created with score:', testPlayerResult.final_score);

        // Test Hall of Fame Repository
        console.log('5. Testing Hall of Fame Repository...');
        const hallOfFameRepo = new HallOfFameRepository();
        const testHallOfFameEntry = await hallOfFameRepo.createEntry({
            username: testUser.username,
            character_name: 'TestChar',
            score: 180,
            accuracy: 80.0,
            max_multiplier: 4,
            question_set_name: questionSets.length > 0 && questionSets[0] ? questionSets[0].name : 'Test Set',
            question_set_id: questionSets.length > 0 && questionSets[0] ? questionSets[0].id : 1,
            session_id: testSession.id
        });
        console.log('✅ Hall of Fame entry created with score:', testHallOfFameEntry.score);

        // Test advanced repository queries
        console.log('6. Testing advanced queries...');
        
        const playerStats = await gameSessionRepo.getPlayerStats(testUser.id);
        console.log('✅ Player stats - Total games:', playerStats?.totalGames || 0, 'Best score:', playerStats?.bestScore || 0);

        const topScores = await hallOfFameRepo.getTopScores(undefined, 5);
        console.log('✅ Top scores retrieved:', topScores.length);

        const isEligible = await hallOfFameRepo.isScoreEligibleForHallOfFame(200, questionSets.length > 0 && questionSets[0] ? questionSets[0].id : 1);
        console.log('✅ Score eligibility check:', isEligible);

        const lobbyCount = await lobbyRepo.getActiveLobbyCount();
        console.log('✅ Active lobby count:', lobbyCount);

        // Test question validation
        if (questionSets.length > 0 && questionSets[0]) {
            const questions = await questionRepo.findQuestionsBySetId(questionSets[0].id);
            if (questions.length > 0 && questions[0]) {
                const isValid = await questionRepo.validateQuestionStructure(questions[0].id);
                console.log('✅ Question structure validation:', isValid);
            }
        }

        // Clean up test data
        console.log('7. Cleaning up test data...');
        await hallOfFameRepo.deleteEntry(testHallOfFameEntry.id);
        await gameSessionRepo.deletePlayerResult(testPlayerResult.id);
        await gameSessionRepo.deleteGameSession(testSession.id);
        await lobbyRepo.deleteLobby(testLobby.id);
        await userRepo.deleteUser(testUser.id);
        console.log('✅ Test data cleaned up');

        console.log('\n🎉 All repository tests passed successfully!');

    } catch (error) {
        console.error('❌ Repository test failed:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    } finally {
        await db.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
testRepositories();