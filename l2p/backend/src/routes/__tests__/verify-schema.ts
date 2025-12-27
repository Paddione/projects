import { DatabaseService } from '../../services/DatabaseService.js';

const db = DatabaseService.getInstance();

async function verifySchema() {
    console.log('🔍 Verifying database schema against design requirements...');

    try {
        // Check if all required tables exist
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map((row: any) => row.table_name);
        console.log('📋 Found tables:', tables);

        const requiredTables = [
            'users',
            'lobbies', 
            'question_sets',
            'questions',
            'game_sessions',
            'player_results',
            'hall_of_fame',
            'schema_migrations',
            'health_check'
        ];

        const missingTables = requiredTables.filter(table => !tables.includes(table));
        if (missingTables.length > 0) {
            console.log('❌ Missing tables:', missingTables);
        } else {
            console.log('✅ All required tables exist');
        }

        // Check indexes
        const indexesResult = await db.query(`
            SELECT indexname, tablename 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname
        `);
        
        console.log('📊 Found indexes:', indexesResult.rows.length);
        
        // Check specific important indexes
        const importantIndexes = [
            'idx_users_username',
            'idx_users_email',
            'idx_lobbies_code',
            'idx_lobbies_status',
            'idx_questions_set_id',
            'idx_hall_of_fame_score_desc'
        ];

        const existingIndexes = indexesResult.rows.map((row: any) => row.indexname);
        const missingIndexes = importantIndexes.filter(index => !existingIndexes.includes(index));
        
        if (missingIndexes.length > 0) {
            console.log('❌ Missing important indexes:', missingIndexes);
        } else {
            console.log('✅ All important indexes exist');
        }

        // Check table structures for key tables
        console.log('🔍 Checking table structures...');

        // Check users table
        const usersColumns = await db.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        `);
        console.log('👤 Users table columns:', usersColumns.rows.length);

        // Check lobbies table
        const lobbiesColumns = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'lobbies' 
            ORDER BY ordinal_position
        `);
        console.log('🏠 Lobbies table columns:', lobbiesColumns.rows.length);

        // Check questions table for JSONB support
        const questionsJsonb = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'questions' 
            AND data_type = 'jsonb'
        `);
        console.log('📝 Questions JSONB columns:', questionsJsonb.rows.map((r: any) => r.column_name));

        // Check foreign key constraints
        const foreignKeys = await db.query(`
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name
        `);
        console.log('🔗 Foreign key constraints:', foreignKeys.rows.length);

        // Test sample data
        console.log('📊 Checking sample data...');
        
        const questionSetsCount = await db.query('SELECT COUNT(*) as count FROM question_sets');
        console.log('📚 Question sets:', questionSetsCount.rows[0]!.count);

        const questionsCount = await db.query('SELECT COUNT(*) as count FROM questions');
        console.log('❓ Questions:', questionsCount.rows[0]!.count);

        // Test JSONB functionality
        const jsonbTest = await db.query(`
            SELECT question_text->>'en' as english_text, question_text->>'de' as german_text
            FROM questions 
            LIMIT 1
        `);
        
        if (jsonbTest.rows.length > 0) {
            console.log('🌐 JSONB localization test:');
            console.log('   English:', jsonbTest.rows[0]!.english_text);
            console.log('   German:', jsonbTest.rows[0]!.german_text);
        }

        console.log('\n✅ Schema verification completed successfully!');

    } catch (error) {
        console.error('❌ Schema verification failed:', error);
        process.exit(1);
    } finally {
        await db.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the verification
verifySchema();