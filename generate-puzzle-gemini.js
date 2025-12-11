#!/usr/bin/env node
/**
 * Gemini AI-Powered Hebrew Puzzle Generator for Connections Game
 * 
 * Usage:
 *   npm run generate-gemini              # Generate tomorrow's puzzle
 *   npm run generate-gemini-week         # Generate next 7 days
 *   npm run preview-gemini               # Preview without saving
 *   node generate-puzzle-gemini.js --date 2025-12-01  # Specific date
 * 
 * Puzzles are saved directly to Firebase Firestore (not to puzzles.json)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
  puzzlesFile: path.join(__dirname, 'puzzles.json'), // Legacy, kept for validation/stats
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'connectionsio',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
};

// Initialize Firebase Admin SDK
let db = null;
function initFirebase() {
  if (db) return db;
  
  try {
    let firebaseConfig = { projectId: CONFIG.firebaseProjectId };
    
    // Use service account if provided, otherwise use Application Default Credentials
    if (CONFIG.firebaseServiceAccountPath && fs.existsSync(CONFIG.firebaseServiceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(CONFIG.firebaseServiceAccountPath, 'utf8'));
      firebaseConfig.credential = cert(serviceAccount);
      console.log('🔐 Using service account credentials');
    } else {
      console.log('🔐 Using Application Default Credentials (ADC)');
      console.log('   If this fails, set FIREBASE_SERVICE_ACCOUNT_PATH in .env');
    }
    
    initializeApp(firebaseConfig);
    db = getFirestore();
    console.log('✅ Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.error('\n💡 To fix this:');
    console.error('   1. Download service account key from Firebase Console');
    console.error('   2. Save it as firebase-service-account.json');
    console.error('   3. Add FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json to .env');
    return null;
  }
}

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
 * Get list of recently used words from existing puzzles
 */
function getRecentlyUsedWords(existingPuzzles, daysToLookBack = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToLookBack);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  const usedWords = new Set();
  const usedExplanations = new Set();
  
  existingPuzzles.forEach(puzzle => {
    if (puzzle.date >= cutoffStr) {
      puzzle.words?.forEach(word => usedWords.add(word));
      puzzle.groups?.forEach(group => {
        if (group.explanation) {
          usedExplanations.add(group.explanation.toLowerCase());
        }
      });
    }
  });
  
  return {
    words: Array.from(usedWords),
    explanations: Array.from(usedExplanations)
  };
}

/**
 * Generate a puzzle using Gemini AI
 */
async function generatePuzzleWithGemini(date, existingPuzzles = []) {
  console.log(`\n🤖 Generating puzzle for ${date} using Gemini ${CONFIG.model}...`);
  
  // Get recently used words to avoid
  const recentlyUsed = getRecentlyUsedWords(existingPuzzles, 14);
  
  let avoidWordsSection = '';
  if (recentlyUsed.words.length > 0) {
    // Show a sample of words to avoid (Gemini has context limits)
    const wordsToShow = recentlyUsed.words.slice(0, 100);
    avoidWordsSection = `

⚠️ חשוב מאוד - אל תשתמש במילים הבאות (כבר הופיעו בחידות קודמות):
${wordsToShow.join(', ')}
${recentlyUsed.words.length > 100 ? `\n(ועוד ${recentlyUsed.words.length - 100} מילים נוספות)` : ''}

בחר מילים חדשות ומקוריות שלא הופיעו ברשימה למעלה!`;
    
    console.log(`   📋 Avoiding ${recentlyUsed.words.length} recently used words`);
  }
  
  let avoidExplanationsSection = '';
  if (recentlyUsed.explanations.length > 0) {
    const explanationsToShow = recentlyUsed.explanations.slice(0, 20);
    avoidExplanationsSection = `

⚠️ נושאים/קשרים שכבר היו - בחר נושאים שונים:
${explanationsToShow.join('\n')}`;
    
    console.log(`   📋 Avoiding ${recentlyUsed.explanations.length} recently used themes`);
  }
  
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
${avoidWordsSection}
${avoidExplanationsSection}

דוגמאות לקשרים מעניינים:
- "מילים שמסתיימות ב___"
- "דברים שקשורים ל___"
- "ביטויים שמתחילים ב___"
- "דמויות מ___"
- "חלקים של___"
- "מילים שאפשר להוסיף להן את המילה ___"
- "שמות של ___"
- "סלנג ל___"
- "מילים נרדפות ל___"

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
- אל תשתמש במילים שכבר הופיעו בחידות קודמות!
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
 * Load existing puzzles from Firestore
 */
async function loadPuzzles() {
  const firestore = initFirebase();
  
  if (!firestore) {
    // Fallback to local JSON for validation
    console.log('⚠️  Loading from local puzzles.json for validation...');
    try {
      const data = fs.readFileSync(CONFIG.puzzlesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { puzzles: [] };
    }
  }
  
  try {
    console.log('📥 Loading existing puzzles from Firestore...');
    const puzzlesRef = firestore.collection('puzzles');
    const snapshot = await puzzlesRef.orderBy('date', 'desc').limit(100).get();
    
    const puzzles = [];
    snapshot.forEach(doc => {
      puzzles.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`   Found ${puzzles.length} existing puzzles`);
    return { puzzles };
  } catch (error) {
    console.error('❌ Error loading puzzles from Firestore:', error.message);
    return { puzzles: [] };
  }
}

/**
 * Save puzzle to Firestore
 */
async function savePuzzle(puzzle, data) {
  const firestore = initFirebase();
  
  if (!firestore) {
    console.error('❌ Cannot save: Firebase not initialized');
    console.log('💡 Falling back to local JSON file...');
    savePuzzleToJSON(puzzle, data);
    return;
  }
  
  try {
    // Check if puzzle already exists
    const existingIndex = data.puzzles.findIndex(p => p.date === puzzle.date);
    
    if (existingIndex >= 0) {
      console.log(`\n⚠️  Puzzle for ${puzzle.date} already exists in Firestore.`);
    }
    
    // Save to Firestore (using date as document ID)
    const puzzleRef = firestore.collection('puzzles').doc(puzzle.date);
    await puzzleRef.set({
      date: puzzle.date,
      words: puzzle.words,
      groups: puzzle.groups,
      createdAt: new Date(),
      generatedBy: 'gemini-ai'
    });
    
    console.log(`✅ Saved puzzle for ${puzzle.date} to Firestore`);
    
    // Also update local cache
    if (existingIndex >= 0) {
      data.puzzles[existingIndex] = puzzle;
    } else {
      data.puzzles.push(puzzle);
    }
    
  } catch (error) {
    console.error('❌ Error saving to Firestore:', error.message);
    console.log('💡 Falling back to local JSON file...');
    savePuzzleToJSON(puzzle, data);
  }
}

/**
 * Fallback: Save puzzle to puzzles.json (legacy)
 */
function savePuzzleToJSON(puzzle, data) {
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
  console.log(`💾 Saved to ${CONFIG.puzzlesFile} (local fallback)`);
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
    retry: parseInt(args.find(arg => arg.startsWith('--retry='))?.split('=')[1]) || 5, // Increased default
    days: parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 
          (args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) : 1),
    date: args.find(arg => arg.startsWith('--date='))?.split('=')[1] ||
          (args.includes('--date') ? args[args.indexOf('--date') + 1] : null)
  };
  
  console.log('\n🎮 Connections - Gemini AI Puzzle Generator');
  console.log(`🤖 Using model: ${CONFIG.model}`);
  console.log(`🎯 Mode: ${flags.preview ? 'Preview' : 'Generate & Save to Firestore'}`);
  console.log(`🔍 Duplicate Check: ${flags.allowReuse ? 'Disabled' : 'Enabled'}`);
  
  const data = await loadPuzzles();
  
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
  
  // Track failed dates for exit code
  const failedDates = [];
  
  // Generate puzzles
  for (const date of datesToGenerate) {
    let attempts = 0;
    let success = false;
    
    while (attempts < flags.retry && !success) {
      attempts++;
      if (attempts > 1) {
        console.log(`\n🔄 Retry attempt ${attempts}/${flags.retry} (looking for unique words)...`);
        // Add a small delay between retries
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      try {
        // Generate (pass existing puzzles so Gemini knows what to avoid)
        const puzzle = await generatePuzzleWithGemini(date, data.puzzles);
        
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
            await savePuzzle(puzzle, data);
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
      failedDates.push(date);
    }
  }
  
  // Exit with error code if any puzzles failed (so CI can detect and retry with force)
  if (failedDates.length > 0) {
    console.log(`\n❌ Failed to generate unique puzzles for: ${failedDates.join(', ')}`);
    console.log('💡 Run with --force to save anyway\n');
    process.exit(1);
  }
  
  console.log('\n🎉 Done!\n');
}

// Run
main().catch(err => {
  console.error(err);
  process.exit(1);
});

