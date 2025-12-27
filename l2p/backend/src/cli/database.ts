#!/usr/bin/env node

import { db } from '../services/DatabaseService.js';
import { migrationService } from '../services/MigrationService.js';
import fs from 'fs';

const command = process.argv[2];
const args = process.argv.slice(3);

async function explainQuery(sql: string, params: any[] = [], analyze = false) {
  const planType = analyze ? 'EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)' : 'EXPLAIN (BUFFERS, VERBOSE, FORMAT JSON)';
  const { rows } = await db.query<any>(`${planType} ${sql}`, params);
  return rows[0]['QUERY PLAN'];
}

async function checkPlanCost(sql: string, params: any[] = [], maxTotalCost = 500000) {
  const plan = await explainQuery(sql, params, false);
  const totalCost = plan?.[0]?.Plan?.['Total Cost'] ?? plan?.[0]?.Plan?.TotalCost ?? 0;
  if (Number(totalCost) > maxTotalCost) {
    throw new Error(`Plan cost ${totalCost} exceeds threshold ${maxTotalCost}`);
  }
  return { plan, totalCost };
}

async function topSlow(limit: number = 10) {
  const { rows } = await db.query<any>(
    `SELECT query, calls, total_exec_time, mean_exec_time, rows
     FROM pg_stat_statements
     WHERE query NOT ILIKE 'EXPLAIN%'
     ORDER BY mean_exec_time DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

async function runCommand() {
  try {
    switch (command) {
      case 'migrate':
        console.log('Running database migrations...');
        await migrationService.runMigrations();
        break;
        
      case 'rollback':
        const version = args[0];
        console.log(`Rolling back migration${version ? ` ${version}` : ''}...`);
        await migrationService.rollbackMigration(version);
        break;
        
      case 'status':
        console.log('Getting migration status...');
        const status = await migrationService.getMigrationStatus();
        console.log('Applied migrations:', status.applied);
        console.log('Pending migrations:', status.pending);
        console.log(`Total migrations: ${status.total}`);
        break;
        
      case 'validate':
        console.log('Validating migrations...');
        const isValid = await migrationService.validateMigrations();
        console.log(`Validation result: ${isValid ? 'PASSED' : 'FAILED'}`);
        if (!isValid) process.exit(1);
        break;
        
      case 'health':
        console.log('Checking database health...');
        const health = await db.healthCheck();
        console.log(`Status: ${health.status}`);
        console.log(`Response time: ${health.details.responseTime}ms`);
        console.log('Pool status:', health.details.poolStatus);
        break;
        
      case 'test':
        console.log('Testing database connection...');
        await db.testConnection();
        console.log('Database connection test passed!');
        break;

      case 'explain': {
        const sql = args.join(' ');
        if (!sql) throw new Error('Usage: db: explain <SQL...>');
        const plan = await explainQuery(sql, []);
        console.log(JSON.stringify(plan, null, 2));
        break;
      }

      case 'explain-file': {
        const file = args[0];
        if (!file || !fs.existsSync(file)) throw new Error('Usage: db: explain-file <path-to-sql-file>');
        const sql = fs.readFileSync(file, 'utf8');
        const plan = await explainQuery(sql, []);
        console.log(JSON.stringify(plan, null, 2));
        break;
      }

      case 'top-slow': {
        const limit = Number(args[0] || 10);
        const rows = await topSlow(limit);
        console.log(JSON.stringify(rows, null, 2));
        break;
      }

      case 'check-plans': {
        const threshold = Number(process.env['MAX_PLAN_COST'] || args[0] || 500000);
        // Curated critical queries
        const checks: Array<{sql: string; params?: any[]; name: string;}> = [
          { name: 'UserRepository.findByEmail', sql: 'SELECT * FROM users WHERE email = $1', params: ['example@example.com'] },
          { name: 'LobbyRepository.findByCode', sql: 'SELECT * FROM lobbies WHERE code = $1', params: ['ABC123'] },
          { name: 'QuestionRepository.searchQuestions', sql: "SELECT * FROM questions WHERE (question_text->>'en' ILIKE $1 OR question_text->>'de' ILIKE $1) ORDER BY id LIMIT 50", params: ['%test%'] },
          { name: 'HallOfFameRepository.getTopScores', sql: 'SELECT * FROM hall_of_fame ORDER BY score DESC, completed_at ASC LIMIT $1', params: [10] },
        ];
        let failures = 0;
        for (const check of checks) {
          try {
            const { totalCost } = await checkPlanCost(check.sql, check.params || [], threshold);
            console.log(`[OK] ${check.name} cost=${totalCost}`);
          } catch (e) {
            failures++;
            console.error(`[FAIL] ${check.name}: ${(e as Error).message}`);
          }
        }
        if (failures > 0) process.exit(1);
        break;
      }
        
      default:
        console.log('Available commands:');
        console.log('  migrate        - Run pending migrations');
        console.log('  rollback       - Rollback last migration (or specify version)');
        console.log('  status         - Show migration status');
        console.log('  validate       - Validate applied migrations');
        console.log('  health         - Check database health');
        console.log('  test           - Test database connection');
        console.log('  explain        - EXPLAIN (JSON) a SQL statement');
        console.log('  explain-file   - EXPLAIN (JSON) a SQL file');
        console.log('  top-slow       - Show top slow queries via pg_stat_statements');
        console.log('  check-plans    - Run EXPLAIN on critical queries and enforce cost thresholds');
        break;
    }
  } catch (error) {
    console.error('Command failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

runCommand();
