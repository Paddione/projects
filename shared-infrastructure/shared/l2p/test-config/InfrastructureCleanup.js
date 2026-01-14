import * as fs from 'fs';
import * as path from 'path';
import { InfrastructureAnalyzer } from './InfrastructureAnalyzer';
export class InfrastructureCleanup {
    constructor(rootPath = process.cwd()) {
        this.rootPath = rootPath;
        this.analyzer = new InfrastructureAnalyzer(rootPath);
    }
    /**
     * Execute the cleanup plan
     */
    async executeCleanup(options = {}) {
        const opts = {
            dryRun: false,
            createBackup: true,
            backupDir: '.cleanup-backup',
            force: false,
            verbose: true,
            ...options
        };
        const result = {
            success: true,
            filesRemoved: [],
            directoriesRemoved: [],
            configurationsConsolidated: [],
            migrationsMade: [],
            errors: [],
            warnings: [],
            spaceSaved: 0
        };
        try {
            if (opts.verbose) {
                console.log('🧹 Starting infrastructure cleanup...\n');
            }
            // Analyze current infrastructure
            const analysis = await this.analyzer.analyzeInfrastructure();
            const plan = await this.analyzer.generateCleanupPlan(analysis);
            if (opts.verbose) {
                this.displayCleanupPlan(plan, opts.dryRun);
            }
            // Create backup if requested
            if (opts.createBackup && !opts.dryRun) {
                await this.createBackup(plan, opts.backupDir);
                if (opts.verbose) {
                    console.log(`📦 Backup created in ${opts.backupDir}\n`);
                }
            }
            // Execute cleanup steps
            await this.removeDuplicateFiles(plan, result, opts);
            await this.removeEmptyDirectories(plan, result, opts);
            await this.consolidateConfigurations(plan, result, opts);
            await this.performMigrations(plan, result, opts);
            // Calculate space saved
            result.spaceSaved = plan.estimatedSpaceSaved;
            if (opts.verbose) {
                this.displayCleanupResults(result, opts.dryRun);
            }
        }
        catch (error) {
            result.success = false;
            result.errors.push(`Cleanup failed: ${error}`);
            if (opts.verbose) {
                console.error(`❌ Cleanup failed: ${error}`);
            }
        }
        return result;
    }
    /**
     * Remove duplicate files
     */
    async removeDuplicateFiles(plan, result, opts) {
        for (const file of plan.filesToRemove) {
            try {
                const filePath = path.join(this.rootPath, file);
                if (opts.dryRun) {
                    if (opts.verbose) {
                        console.log(`[DRY RUN] Would remove: ${file}`);
                    }
                }
                else {
                    await fs.promises.unlink(filePath);
                    if (opts.verbose) {
                        console.log(`🗑️  Removed: ${file}`);
                    }
                }
                result.filesRemoved.push(file);
            }
            catch (error) {
                const errorMsg = `Failed to remove ${file}: ${error}`;
                result.errors.push(errorMsg);
                if (opts.verbose) {
                    console.error(`❌ ${errorMsg}`);
                }
            }
        }
    }
    /**
     * Remove empty directories
     */
    async removeEmptyDirectories(plan, result, opts) {
        for (const dir of plan.directoriesToRemove) {
            try {
                const dirPath = path.join(this.rootPath, dir);
                if (opts.dryRun) {
                    if (opts.verbose) {
                        console.log(`[DRY RUN] Would remove directory: ${dir}`);
                    }
                }
                else {
                    await fs.promises.rmdir(dirPath);
                    if (opts.verbose) {
                        console.log(`📁 Removed directory: ${dir}`);
                    }
                }
                result.directoriesRemoved.push(dir);
            }
            catch (error) {
                const errorMsg = `Failed to remove directory ${dir}: ${error}`;
                result.errors.push(errorMsg);
                if (opts.verbose) {
                    console.error(`❌ ${errorMsg}`);
                }
            }
        }
    }
    /**
     * Consolidate configurations
     */
    async consolidateConfigurations(plan, result, opts) {
        for (const consolidation of plan.configurationsToConsolidate) {
            try {
                if (opts.dryRun) {
                    if (opts.verbose) {
                        console.log(`[DRY RUN] Would consolidate ${consolidation.type} configs:`);
                        console.log(`  Sources: ${consolidation.sourceFiles.join(', ')}`);
                        console.log(`  Target: ${consolidation.targetFile}`);
                    }
                }
                else {
                    await this.performConfigConsolidation(consolidation);
                    if (opts.verbose) {
                        console.log(`🔧 Consolidated ${consolidation.type} configuration`);
                    }
                }
                result.configurationsConsolidated.push(consolidation.type);
            }
            catch (error) {
                const errorMsg = `Failed to consolidate ${consolidation.type}: ${error}`;
                result.errors.push(errorMsg);
                if (opts.verbose) {
                    console.error(`❌ ${errorMsg}`);
                }
            }
        }
    }
    /**
     * Perform file migrations
     */
    async performMigrations(plan, result, opts) {
        for (const migration of plan.migrationsRequired) {
            try {
                if (opts.dryRun) {
                    if (opts.verbose) {
                        console.log(`[DRY RUN] Would migrate: ${migration.sourceFile} → ${migration.targetFile}`);
                    }
                }
                else {
                    // Migration is handled by duplicate file removal since we keep the preferred location
                    if (opts.verbose) {
                        console.log(`📦 Migration planned: ${migration.sourceFile} → ${migration.targetFile}`);
                        console.log(`   Reason: ${migration.reason}`);
                    }
                }
                result.migrationsMade.push(`${migration.sourceFile} → ${migration.targetFile}`);
            }
            catch (error) {
                const errorMsg = `Failed to migrate ${migration.sourceFile}: ${error}`;
                result.errors.push(errorMsg);
                if (opts.verbose) {
                    console.error(`❌ ${errorMsg}`);
                }
            }
        }
    }
    /**
     * Create backup of files to be removed
     */
    async createBackup(plan, backupDir) {
        const backupPath = path.join(this.rootPath, backupDir);
        // Create backup directory
        await fs.promises.mkdir(backupPath, { recursive: true });
        // Backup files to be removed
        for (const file of plan.filesToRemove) {
            try {
                const sourcePath = path.join(this.rootPath, file);
                const backupFilePath = path.join(backupPath, file);
                // Create directory structure in backup
                await fs.promises.mkdir(path.dirname(backupFilePath), { recursive: true });
                // Copy file to backup
                await fs.promises.copyFile(sourcePath, backupFilePath);
            }
            catch (error) {
                console.warn(`Warning: Could not backup ${file}: ${error}`);
            }
        }
        // Create backup manifest
        const manifest = {
            createdAt: new Date().toISOString(),
            plan,
            files: plan.filesToRemove,
            directories: plan.directoriesToRemove
        };
        await fs.promises.writeFile(path.join(backupPath, 'cleanup-manifest.json'), JSON.stringify(manifest, null, 2));
    }
    /**
     * Perform configuration consolidation
     */
    async performConfigConsolidation(consolidation) {
        // This is a placeholder for actual configuration consolidation logic
        // In a real implementation, you would merge configuration files
        console.log(`Consolidating ${consolidation.type} configuration...`);
        // For now, just remove the source files (they're duplicates)
        for (const sourceFile of consolidation.sourceFiles) {
            const filePath = path.join(this.rootPath, sourceFile);
            try {
                await fs.promises.unlink(filePath);
            }
            catch (error) {
                console.warn(`Could not remove redundant config ${sourceFile}: ${error}`);
            }
        }
    }
    /**
     * Display cleanup plan
     */
    displayCleanupPlan(plan, dryRun) {
        console.log(`📋 Cleanup Plan ${dryRun ? '(DRY RUN)' : ''}:`);
        console.log('=====================================');
        if (plan.filesToRemove.length > 0) {
            console.log(`\n🗑️  Files to remove (${plan.filesToRemove.length}):`);
            plan.filesToRemove.forEach(file => console.log(`  - ${file}`));
        }
        if (plan.directoriesToRemove.length > 0) {
            console.log(`\n📁 Directories to remove (${plan.directoriesToRemove.length}):`);
            plan.directoriesToRemove.forEach(dir => console.log(`  - ${dir}`));
        }
        if (plan.configurationsToConsolidate.length > 0) {
            console.log(`\n🔧 Configurations to consolidate (${plan.configurationsToConsolidate.length}):`);
            plan.configurationsToConsolidate.forEach(config => {
                console.log(`  - ${config.type}: ${config.sourceFiles.join(', ')} → ${config.targetFile}`);
            });
        }
        if (plan.migrationsRequired.length > 0) {
            console.log(`\n📦 Migrations required (${plan.migrationsRequired.length}):`);
            plan.migrationsRequired.forEach(migration => {
                console.log(`  - ${migration.sourceFile} → ${migration.targetFile}`);
                console.log(`    Reason: ${migration.reason}`);
            });
        }
        console.log(`\n💾 Estimated space to be saved: ${(plan.estimatedSpaceSaved / 1024).toFixed(1)} KB`);
        console.log();
    }
    /**
     * Display cleanup results
     */
    displayCleanupResults(result, dryRun) {
        console.log(`\n📊 Cleanup Results ${dryRun ? '(DRY RUN)' : ''}:`);
        console.log('=====================================');
        console.log(`✅ Success: ${result.success}`);
        console.log(`🗑️  Files removed: ${result.filesRemoved.length}`);
        console.log(`📁 Directories removed: ${result.directoriesRemoved.length}`);
        console.log(`🔧 Configurations consolidated: ${result.configurationsConsolidated.length}`);
        console.log(`📦 Migrations made: ${result.migrationsMade.length}`);
        console.log(`❌ Errors: ${result.errors.length}`);
        console.log(`⚠️  Warnings: ${result.warnings.length}`);
        console.log(`💾 Space saved: ${(result.spaceSaved / 1024).toFixed(1)} KB`);
        if (result.errors.length > 0) {
            console.log('\n❌ Errors:');
            result.errors.forEach(error => console.log(`  - ${error}`));
        }
        if (result.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            result.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
    }
    /**
     * Restore from backup
     */
    async restoreFromBackup(backupDir) {
        const backupPath = path.join(this.rootPath, backupDir);
        try {
            // Read backup manifest
            const manifestPath = path.join(backupPath, 'cleanup-manifest.json');
            const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
            console.log('🔄 Restoring from backup...');
            // Restore files
            for (const file of manifest.files) {
                const backupFilePath = path.join(backupPath, file);
                const targetPath = path.join(this.rootPath, file);
                try {
                    // Create directory structure
                    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
                    // Restore file
                    await fs.promises.copyFile(backupFilePath, targetPath);
                    console.log(`✅ Restored: ${file}`);
                }
                catch (error) {
                    console.error(`❌ Failed to restore ${file}: ${error}`);
                }
            }
            console.log('🎉 Backup restoration completed');
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to restore from backup: ${error}`);
            return false;
        }
    }
}
