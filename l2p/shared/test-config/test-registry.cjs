#!/usr/bin/env node

const { TestFileRegistry } = require('./cjs/TestFileRegistry.js');
const path = require('path');

async function testRegistry() {
  console.log('🧪 Testing TestFileRegistry...\n');
  
  // Use the project root (two levels up from shared/test-config)
  const projectRoot = path.resolve(__dirname, '../..');
  console.log(`Project root: ${projectRoot}\n`);
  
  const registry = new TestFileRegistry(projectRoot);
  
  try {
    console.log('🔍 Discovering test files...');
    const fileMap = await registry.discoverTestFiles();
    
    console.log('\n📊 Results:');
    console.log('===========');
    
    Object.entries(fileMap).forEach(([type, files]) => {
      if (files.length > 0) {
        console.log(`\n${type.toUpperCase()} (${files.length} files):`);
        files.slice(0, 5).forEach(file => console.log(`  - ${file}`));
        if (files.length > 5) {
          console.log(`  ... and ${files.length - 5} more`);
        }
      }
    });
    
    const totalFiles = Object.values(fileMap).flat().length;
    console.log(`\n✅ Total test files discovered: ${totalFiles}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRegistry();