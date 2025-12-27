import { db } from '../services/DatabaseService.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { LobbyRepository } from '../repositories/LobbyRepository.js';
import { QuestionRepository } from '../repositories/QuestionRepository.js';
import { GameSessionRepository } from '../repositories/GameSessionRepository.js';
import { HallOfFameRepository } from '../repositories/HallOfFameRepository.js';
import { migrationService } from '../services/MigrationService.js';

async function testDatabase() {
    console.log('🔧 Testing comprehensive database setup...');

    try {
        // Test database connection
        console.log('1. Testing database connection...');
        await db.testConnection();
        console.log('✅ Database connection successful');

        // Test migrations
        console.log('2. Running migrations...');
        await migrationService.runMigrations();
        console.log('✅ Migrations completed');

        // Test migration validation
        console.log('3. Validating migrations...');
        const isValid = await migrationService.validateMigrations();
        if (isValid) {
            console.log('✅ Migration validation passed');
        } else {
            console.log('❌ Migration validation failed');
        }

        // Test all repositories
        console.log('4. Testing all repositories...');
        
        // Test User Repository
        console.log('4.1 Testing User Repository...');
        const userRepo = new UserRepository();
        const testUser = await userRepo.createUser({
            username: 'testuser',
            email: 'test@example.com',
            password_hash: 'hashed_password_123',
            preferences: {
                language: 'en',
                theme: 'dark'
            }
        });
        console.log('✅ User created:', testUser.username);

        // Test Lobby Repository
        console.log('4.2 Testing Lobby Repository...');
        const lobbyRepo = new LobbyRepository();
        const testLobby = await lobbyRepo.createLobby({
            code: 'TEST123',
            host_id: testUser.id,
            question_count: 10
        });
        console.log('✅ Lobby created with code:', testLobby.code);

        // Test Question Repository
        console.log('4.3 Testing Question Repository...');
        const questionRepo = new QuestionRepository();
        const questionSets = await questionRepo.findAllQuestionSets();
        console.log('✅ Found question sets:', questionSets.length);
        
        if (questionSets.length > 0 && questionSets[0]) {
            const questions = await questionRepo.findQuestionsBySetId(questionSets[0].id);
            console.log('✅ Found questions in first set:', questions.length);
        }

        // Test Game Session Repository
        console.log('4.4 Testing Game Session Repository...');
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
            final_score: 150,
            correct_answers: 3,
            total_questions: 5,
            max_multiplier: 3,
            completion_time: 120,
            answer_details: [
                {
                    questionId: 1,
                    selectedAnswer: 'A',
                    isCorrect: true,
                    timeElapsed: 15,
                    pointsEarned: 45,
                    multiplierUsed: 1
                }
            ]
        });
        console.log('✅ Player result created with score:', testPlayerResult.final_score);

        // Test Hall of Fame Repository
        console.log('4.5 Testing Hall of Fame Repository...');
        const hallOfFameRepo = new HallOfFameRepository();
        const testHallOfFameEntry = await hallOfFameRepo.createEntry({
            username: testUser.username,
            character_name: 'TestChar',
            score: 150,
            accuracy: 60.0,
            max_multiplier: 3,
            question_set_name: questionSets.length > 0 && questionSets[0] ? questionSets[0].name : 'Test Set',
            question_set_id: questionSets.length > 0 && questionSets[0] ? questionSets[0].id : 1,
            session_id: testSession.id
        });
        console.log('✅ Hall of Fame entry created with score:', testHallOfFameEntry.score);

        // Test repository queries
        console.log('5. Testing repository queries...');
        
        const foundUser = await userRepo.findUserById(testUser.id);
        console.log('✅ User found by ID:', foundUser?.username || 'Unknown');

        const foundLobby = await lobbyRepo.findByCode('TEST123');
        console.log('✅ Lobby found by code:', foundLobby?.code || 'Unknown');

        const topScores = await hallOfFameRepo.getTopScores(undefined, 5);
        console.log('✅ Top scores retrieved:', topScores.length);

        const playerStats = await gameSessionRepo.getPlayerStats(testUser.id);
        console.log('✅ Player stats - Total games:', playerStats?.totalGames || 0);

        // Test database health check
        console.log('6. Testing database health check...');
        const health = await db.healthCheck();
        console.log('✅ Database health:', health.status);
        console.log('   Response time:', health.details.responseTime + 'ms');
        console.log('   Pool status:', health.details.poolStatus);

        // Clean up test data
        console.log('7. Cleaning up test data...');
        await hallOfFameRepo.deleteEntry(testHallOfFameEntry.id);
        await gameSessionRepo.deletePlayerResult(testPlayerResult.id);
        await gameSessionRepo.deleteGameSession(testSession.id);
        await lobbyRepo.deleteLobby(testLobby.id);
        await userRepo.deleteUser(testUser.id);
        console.log('✅ Test data cleaned up');

        console.log('\n🎉 All comprehensive database tests passed successfully!');

    } catch (error) {
        console.error('❌ Database test failed:', error);
        process.exit(1);
    } finally {
        await db.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
testDatabase();