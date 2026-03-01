#!/usr/bin/env node

/**
 * i18n Coverage Checker for L2P Frontend
 *
 * Scans .tsx files for hardcoded text that should use t() translations.
 * Detects:
 *   1. JSX text content: >Some visible text<
 *   2. Hardcoded string props: title="Hello" placeholder="Type..."
 *   3. Template literals in JSX with text: {`Some text ${var}`}
 *
 * Ignores:
 *   - Single words ≤3 chars, pure numbers, CSS classes, technical tokens
 *   - Files in __tests__/, test/, e2e/, node_modules/
 *   - Known-safe patterns (className, data-*, key=, type=, etc.)
 *   - Comments and imports
 *
 * Usage:
 *   node scripts/check-i18n-coverage.js [--verbose] [--json]
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.resolve(__dirname, '../frontend/src');

const verbose = process.argv.includes('--verbose');
const jsonOutput = process.argv.includes('--json');

// Props that commonly contain user-visible text and should be translated
const TRANSLATABLE_PROPS = new Set([
  'title', 'placeholder', 'aria-label', 'aria-description', 'alt', 'label',
]);

// Props that should NOT be flagged (technical, not user-visible)
const IGNORE_PROPS = new Set([
  'className', 'class', 'id', 'key', 'ref', 'type', 'name', 'value',
  'href', 'src', 'data-testid', 'data-test', 'role', 'htmlFor', 'for',
  'style', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'method', 'action',
  'target', 'rel', 'autoComplete', 'inputMode', 'pattern', 'accept',
  'crossOrigin', 'sizes', 'media', 'as', 'integrity', 'fetchpriority',
  'tabIndex', 'data-slot', 'data-state', 'data-side', 'data-align',
]);

// Directories/files to skip
const SKIP_PATTERNS = [
  '__tests__', 'test/', 'e2e/', 'node_modules', '.test.', '.spec.',
  'localization.ts', 'import-meta.ts',
  'DemoPage.tsx', 'PerformanceMonitor.tsx', 'LogStream.tsx', // dev-only
  'test-utils.tsx', 'LanguageSelector.tsx', // intentionally bilingual
];

// Values to ignore (technical, not human-readable)
const IGNORE_VALUE_PATTERNS = [
  /^\s*$/,                    // empty/whitespace
  /^[a-z][-a-z0-9]*$/,       // single lowercase word (likely CSS/ID)
  /^[A-Z_]+$/,               // constants
  /^\d+(\.\d+)?(%|px|rem|em|vh|vw|ms|s)?$/, // numbers/units
  /^(true|false|null|undefined)$/,
  /^[{(].*[})]$/,            // expressions
  /^https?:\/\//,            // URLs
  /^\//,                     // paths
  /^#[0-9a-fA-F]+$/,         // hex colors
  /^[a-z]+[-_][a-z]+/,       // kebab-case / snake_case (CSS classes, IDs)
  /^(div|span|p|h[1-6]|button|input|form|label|select|option|a|img|svg|path)$/, // HTML tags
  /typeof |\.length|===|!==|\?\?|&&|\|\|/, // code expressions
  /\.[a-zA-Z]+\(/, // method calls (e.g., p.isReady).length)
  /^[a-zA-Z]+\.[a-zA-Z]+/,   // dotted identifiers (questionSet.name)
  /^[a-zA-Z]+\[\]\./, // array field notation (answers[].text)
  /^is[A-Z]/, // boolean field names (isCorrect)
  /^[a-z]+[A-Z]/, // camelCase identifiers (questionText, isCorrect)
  /^[A-Z]{4,}\d+$/, // format hints (CODE12)
];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(p => filePath.includes(p));
}

function isIgnorableValue(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 3) return true;
  return IGNORE_VALUE_PATTERNS.some(pat => pat.test(trimmed));
}

function isLikelyTranslated(line) {
  // Line uses t() around the string
  return /\bt\s*\(/.test(line);
}

function getAllTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') && !shouldSkipFile(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and imports
    if (/^\s*(\/\/|\/\*|\*|import |export (type|interface))/.test(line)) continue;

    // --- Check 1: JSX text content ---
    // Matches: >Some text< or >Some text with {var} more text<
    // Pattern: after > and before <, find non-trivial text
    const jsxTextMatches = line.matchAll(/>\s*([A-ZÄÖÜ][^<>{]*?[a-zäöüß.!?…])\s*</g);
    for (const match of jsxTextMatches) {
      const text = match[1].trim();
      if (!isIgnorableValue(text) && !isLikelyTranslated(line)) {
        issues.push({
          line: lineNum,
          type: 'jsx-text',
          text,
          raw: line.trim(),
        });
      }
    }

    // Also catch lowercase-starting JSX text (e.g., "active", "or enter a code")
    const jsxTextLower = line.matchAll(/>\s*([a-zäöüß][^<>{]*?[a-zäöüß.!?…])\s*</g);
    for (const match of jsxTextLower) {
      const text = match[1].trim();
      if (text.length > 6 && !isIgnorableValue(text) && !isLikelyTranslated(line)) {
        issues.push({
          line: lineNum,
          type: 'jsx-text',
          text,
          raw: line.trim(),
        });
      }
    }

    // --- Check 2: Hardcoded string props ---
    // Matches: title="Some text" placeholder="Enter..."
    const propMatches = line.matchAll(/\b(\w[-\w]*)=["']([^"']{4,})["']/g);
    for (const match of propMatches) {
      const prop = match[1];
      const value = match[2];

      if (IGNORE_PROPS.has(prop)) continue;
      if (!TRANSLATABLE_PROPS.has(prop) && !verbose) continue;
      if (isIgnorableValue(value)) continue;
      if (/^[a-z][-a-z]*$/.test(value)) continue; // CSS-like values
      if (isLikelyTranslated(line)) continue;

      // Only flag if value looks like human-readable text
      if (/[A-ZÄÖÜ]/.test(value) || /\s/.test(value)) {
        issues.push({
          line: lineNum,
          type: 'prop',
          prop,
          text: value,
          raw: line.trim(),
        });
      }
    }

    // --- Check 3: Hardcoded German text (strongest signal) ---
    // Common German words that wouldn't appear in code
    const germanPatterns = /\b(Alle|Bearbeiten|Löschen|Erstellen|Speichern|Antwort|Frage|Pflicht|Feld|Schwierigkeit|Hinweis|Akzeptiert|Nein|Bitte|Keine|Optionen|akzeptiert|verfügbar|erforderlich)\b/;
    if (germanPatterns.test(line) && !isLikelyTranslated(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      // Make sure it's in a JSX context or string literal, not a variable name
      if (/[>'"`]/.test(line)) {
        issues.push({
          line: lineNum,
          type: 'hardcoded-german',
          text: line.trim(),
          raw: line.trim(),
        });
      }
    }
  }

  return issues;
}

// --- Main ---

const files = getAllTsxFiles(FRONTEND_SRC);
const allIssues = [];

for (const file of files) {
  const issues = checkFile(file);
  if (issues.length > 0) {
    const relPath = path.relative(FRONTEND_SRC, file);
    allIssues.push({ file: relPath, issues });
  }
}

if (jsonOutput) {
  console.log(JSON.stringify(allIssues, null, 2));
  process.exit(allIssues.length > 0 ? 1 : 0);
}

// Pretty output
const totalIssues = allIssues.reduce((sum, f) => sum + f.issues.length, 0);
console.log(`\n🔍 i18n Coverage Check — L2P Frontend`);
console.log(`   Scanned ${files.length} .tsx files\n`);

if (totalIssues === 0) {
  console.log('✅ No untranslated strings found!\n');
  process.exit(0);
}

console.log(`⚠️  Found ${totalIssues} potential untranslated strings in ${allIssues.length} files:\n`);

for (const { file, issues } of allIssues) {
  console.log(`📄 ${file}`);
  for (const issue of issues) {
    const icon = issue.type === 'hardcoded-german' ? '🇩🇪' :
                 issue.type === 'prop' ? '📋' : '💬';
    const detail = issue.prop ? `${issue.prop}="${issue.text}"` : `"${issue.text}"`;
    console.log(`   ${icon} L${issue.line}: ${detail}`);
  }
  console.log();
}

console.log(`Legend: 💬 JSX text  📋 Prop value  🇩🇪 Hardcoded German\n`);
process.exit(1);
