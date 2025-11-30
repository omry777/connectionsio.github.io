#!/usr/bin/env node
/**
 * Gemini AI-Powered Hebrew Puzzle Generator for Connections Game
 * 
 * Usage:
 *   npm run generate-gemini              # Generate tomorrow's puzzle
 *   npm run generate-gemini-week         # Generate next 7 days
 *   npm run preview-gemini               # Preview without saving
 *   node generate-puzzle-gemini.js --date 2025-12-01  # Specific date
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { validatePuzzleUniqueness, displayValidationResults, getWordUsageStats } from './puzzle-validator.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
  puzzlesFile: path.join(__dirname, 'puzzles.json')
};

// Validate API key
if (!CONFIG.apiKey || CONFIG.apiKey === 'your-gemini-api-key-here') {
  console.error('\n❌ Error: Gemini API key not configured!');
  console.error('\nPlease:');
  console.error('1. Get your FREE API key from: https://makersuite.google.com/app/apikey');
  console.error('2. Copy .env.example to .env');
  console.error('3. Add your Gemini API key to .env');
  console.error('4. Make sure .env is in .gitignore\n');
  process.exit(1);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(CONFIG.apiKey);
const model = genAI.getGenerativeModel({ model: CONFIG.model });

// Color palette for groups
const COLORS = ['#f44336', '#4caf50', '#9c27b0', '#2196f3'];

/**
 * Generate a puzzle using Gemini AI
 */
async function generatePuzzleWithGemini(date) {
  console.log(`\n🤖 Generating puzzle for ${date} using Gemini ${CONFIG.model}...`);
  
  const prompt = `
אתה מומחה במשחק Connections בעברית ומומחה בתרבות הישראלית.
צור חידת Connections יצירתית ומאתגרת ליום ${date}.

דרישות חשובות:
- 4 קבוצות, כל קבוצה עם 4 מילים בעברית
- הקשרים צריכים להיות יצירתיים אבל לא טריוויאליים
- רמות קושי שונות: 1=קל, 2=בינוני, 3=קשה, 4=מאוד קשה
- הקשרים יכולים להיות: תרבותיים, היסטוריים, לשוניים, קונספטואליים, משחקי מילים
- ודא שכל מילה מופיעה רק פעם אחת
- הסברים צריכים להיות קצרים וברורים (עד 10 מילים)
- השתמש במילים מעניינות ולא טריוויאליות

דוגמאות לקשרים מעניינים:
- "מילים שמסתיימות ב___"
- "דברים שקשורים ל___"
- "ביטויים שמתחילים ב___"
- "דמויות מ___"
- "חלקים של___"
- "מילים שאפשר להוסיף להן את המילה ___"

החזר תשובה בפורמט JSON בלבד (ללא טקסט נוסף):
{
  "date": "${date}",
  "words": ["מילה1", "מילה2", "מילה3", "מילה4", "מילה5", "מילה6", "מילה7", "מילה8", "מילה9", "מילה10", "מילה11", "מילה12", "מילה13", "מילה14", "מילה15", "מילה16"],
  "groups": [
    {
      "words": ["מילה1", "מילה2", "מילה3", "מילה4"],
      "explanation": "הסבר קצר וברור",
      "difficulty": 1
    },
    {
      "words": ["מילה5", "מילה6", "מילה7", "מילה8"],
      "explanation": "הסבר קצר וברור",
      "difficulty": 2
    },
    {
      "words": ["מילה9", "מילה10", "מילה11", "מילה12"],
      "explanation": "הסבר קצר וברור",
      "difficulty": 3
    },
    {
      "words": ["מילה13", "מילה14", "מילה15", "מילה16"],
      "explanation": "הסבר קצר וברור",
      "difficulty": 4
    }
  ]
}

חשוב מאוד:
- כל מילה חייבת להופיע בדיוק פעם אחת
- 16 מילים בדיוק
- 4 קבוצות בדיוק
- כל קבוצה עם 4 מילים בדיוק
- החזר רק JSON, ללא טקסט אחר
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response (Gemini sometimes adds markdown)
    let jsonText = text;
    if (text.includes('```json')) {
      jsonText = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      jsonText = text.split('```')[1].split('```')[0].trim();
    }
    
    const puzzleData = JSON.parse(jsonText);
    
    // Add colors to groups
    puzzleData.groups = puzzleData.groups.map((group, index) => ({
      ...group,
      color: COLORS[index] || COLORS[0]
    }));
    
    return puzzleData;
  } catch (error) {
    console.error('❌ Error generating puzzle:', error.message);
    if (error.message.includes('API key')) {
      console.error('\n💡 Get your FREE API key: https://makersuite.google.com/app/apikey');
    }
    throw error;
  }
}

/**
 * Validate puzzle structure
 */
function validatePuzzle(puzzle) {
  const issues = [];
  
  // Check basic structure
  if (!puzzle.date) issues.push('Missing date');
  if (!Array.isArray(puzzle.words)) issues.push('Words must be an array');
  if (!Array.isArray(puzzle.groups)) issues.push('Groups must be an array');
  
  // Check word count
  if (puzzle.words.length !== 16) {
    issues.push(`Must have exactly 16 words (found ${puzzle.words.length})`);
  }
  
  // Check for duplicates
  const uniqueWords = new Set(puzzle.words);
  if (uniqueWords.size !== 16) {
    issues.push('Contains duplicate words');
  }
  
  // Check groups
  if (puzzle.groups.length !== 4) {
    issues.push(`Must have exactly 4 groups (found ${puzzle.groups.length})`);
  }
  
  // Verify each group
  puzzle.groups.forEach((group, i) => {
    if (!Array.isArray(group.words) || group.words.length !== 4) {
      issues.push(`Group ${i + 1} must have exactly 4 words`);
    }
    
    if (!group.explanation) {
      issues.push(`Group ${i + 1} missing explanation`);
    }
    
    if (!group.color) {
      issues.push(`Group ${i + 1} missing color`);
    }
    
    // All group words must be in main words array
    group.words.forEach(word => {
      if (!puzzle.words.includes(word)) {
        issues.push(`Word "${word}" in group ${i + 1} not in main words array`);
      }
    });
  });
  
  // Check all words are accounted for
  const groupWords = puzzle.groups.flatMap(g => g.words);
  const missingWords = puzzle.words.filter(w => !groupWords.includes(w));
  const extraWords = groupWords.filter(w => !puzzle.words.includes(w));
  
  if (missingWords.length > 0) {
    issues.push(`Words not in any group: ${missingWords.join(', ')}`);
  }
  
  if (extraWords.length > 0) {
    issues.push(`Words in groups but not in main array: ${extraWords.join(', ')}`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Display puzzle for review
 */
function displayPuzzle(puzzle) {
  console.log('\n' + '='.repeat(60));
  console.log(`📅 Puzzle for: ${puzzle.date}`);
  console.log('='.repeat(60));
  
  puzzle.groups.forEach((group, i) => {
    const difficultyStars = '⭐'.repeat(group.difficulty || (i + 1));
    console.log(`\n${difficultyStars} Group ${i + 1}: ${group.explanation}`);
    console.log(`   ${group.words.join(', ')}`);
  });
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Load existing puzzles
 */
function loadPuzzles() {
  try {
    const data = fs.readFileSync(CONFIG.puzzlesFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('Creating new puzzles file...');
    return { puzzles: [] };
  }
}

/**
 * Save puzzle to puzzles.json
 */
function savePuzzle(puzzle, data) {
  // Check if puzzle already exists
  const existingIndex = data.puzzles.findIndex(p => p.date === puzzle.date);
  
  if (existingIndex >= 0) {
    console.log(`\n⚠️  Puzzle for ${puzzle.date} already exists.`);
    data.puzzles[existingIndex] = puzzle;
    console.log('✅ Updated existing puzzle');
  } else {
    data.puzzles.push(puzzle);
    console.log(`✅ Added new puzzle for ${puzzle.date}`);
  }
  
  // Sort by date
  data.puzzles.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Save to file
  fs.writeFileSync(CONFIG.puzzlesFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 Saved to ${CONFIG.puzzlesFile}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const flags = {
    preview: args.includes('--preview'),
    force: args.includes('--force'),
    stats: args.includes('--stats'),
    allowReuse: args.includes('--allow-reuse'),
    retry: parseInt(args.find(arg => arg.startsWith('--retry='))?.split('=')[1]) || 3,
    days: parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 
          (args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) : 1),
    date: args.find(arg => arg.startsWith('--date='))?.split('=')[1] ||
          (args.includes('--date') ? args[args.indexOf('--date') + 1] : null)
  };
  
  console.log('\n🎮 Connections - Gemini AI Puzzle Generator');
  console.log(`🤖 Using model: ${CONFIG.model}`);
  console.log(`🎯 Mode: ${flags.preview ? 'Preview' : 'Generate & Save'}`);
  console.log(`🔍 Duplicate Check: ${flags.allowReuse ? 'Disabled' : 'Enabled'}`);
  
  const data = loadPuzzles();
  
  // Show stats if requested
  if (flags.stats) {
    const stats = getWordUsageStats(data.puzzles);
    console.log('\n' + '='.repeat(70));
    console.log('📊 PUZZLE STATISTICS');
    console.log('='.repeat(70));
    console.log(`\n📚 Total puzzles: ${stats.totalPuzzles}`);
    console.log(`🔤 Unique words used: ${stats.totalWords}`);
    console.log(`📈 Average words per puzzle: ${stats.averageWordsPerPuzzle}`);
    
    if (stats.reusedWords.length > 0) {
      console.log('\n⚠️  MOST REUSED WORDS:');
      console.log('-'.repeat(70));
      console.log('   Word                    | Times Used');
      console.log('-'.repeat(70));
      stats.reusedWords.forEach(([word, count]) => {
        const paddedWord = word.padEnd(20, ' ');
        const times = `${count} times`.padEnd(10, ' ');
        console.log(`   ${paddedWord} | ${times}`);
      });
    } else {
      console.log('\n✅ No words have been reused yet!');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('💡 TIP: Gemini generates unique puzzles every time!');
    console.log('='.repeat(70) + '\n');
    return;
  }
  
  // Determine dates to generate
  const datesToGenerate = [];
  if (flags.date) {
    datesToGenerate.push(flags.date);
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (let i = 0; i < flags.days; i++) {
      const date = new Date(tomorrow);
      date.setDate(date.getDate() + i);
      datesToGenerate.push(date.toISOString().split('T')[0]);
    }
  }
  
  console.log(`\n📅 Generating puzzles for: ${datesToGenerate.join(', ')}`);
  
  // Generate puzzles
  for (const date of datesToGenerate) {
    let attempts = 0;
    let success = false;
    
    while (attempts < flags.retry && !success) {
      attempts++;
      if (attempts > 1) {
        console.log(`\n🔄 Retry attempt ${attempts}/${flags.retry}...`);
      }
      
      try {
        // Generate
        const puzzle = await generatePuzzleWithGemini(date);
        
        // Validate structure
        const validation = validatePuzzle(puzzle);
        if (!validation.valid) {
          console.error('\n❌ Structure validation failed:');
          validation.issues.forEach(issue => console.error(`   - ${issue}`));
          if (attempts < flags.retry) {
            console.log('🔄 Regenerating...');
            continue;
          } else {
            console.log('❌ Max retries reached');
            break;
          }
        }
        
        // Display
        displayPuzzle(puzzle);
        
        // Validate uniqueness
        const uniquenessValidation = validatePuzzleUniqueness(puzzle, data.puzzles, {
          allowWordReuse: flags.allowReuse,
          verbose: true
        });
        
        const isUnique = displayValidationResults(uniquenessValidation);
        
        // Save or preview
        if (!flags.preview) {
          if (isUnique || flags.force) {
            savePuzzle(puzzle, data);
            console.log('\n✅ Success!');
            success = true;
          } else {
            console.log('\n❌ Puzzle not saved due to duplicate words');
            console.log('💡 Use --force to save anyway or regenerate');
            if (attempts < flags.retry) {
              console.log('🔄 Regenerating with different words...');
              continue;
            }
          }
        } else {
          console.log('\n👁️  Preview mode - not saved');
          success = true;
        }
        
        // Small delay between requests
        if (datesToGenerate.length > 1 && success) {
          console.log('\n⏳ Waiting 2 seconds before next generation...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`\n❌ Failed to generate puzzle for ${date}:`, error.message);
        if (attempts < flags.retry) {
          console.log('🔄 Retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!success && !flags.preview) {
      console.log(`\n⚠️  Could not generate valid puzzle for ${date} after ${flags.retry} attempts`);
    }
  }
  
  console.log('\n🎉 Done!\n');
}

// Run
main().catch(console.error);

