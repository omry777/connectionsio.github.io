#!/usr/bin/env node
/**
 * Check if a puzzle already exists in Firebase for a given date
 * 
 * Usage:
 *   node check-puzzle-exists.js                    # Check tomorrow
 *   node check-puzzle-exists.js --date 2025-12-11 # Check specific date
 * 
 * Exit codes:
 *   0 - Puzzle exists
 *   1 - Puzzle does not exist (or error)
 * 
 * Output:
 *   Sets PUZZLE_EXISTS=true/false for GitHub Actions
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CONFIG = {
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'connectionsio',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
};

/**
 * Initialize Firebase Admin SDK
 */
function initFirebase() {
  try {
    let firebaseConfig = { projectId: CONFIG.firebaseProjectId };
    
    if (CONFIG.firebaseServiceAccountPath && fs.existsSync(CONFIG.firebaseServiceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(CONFIG.firebaseServiceAccountPath, 'utf8'));
      firebaseConfig.credential = cert(serviceAccount);
    }
    
    initializeApp(firebaseConfig);
    return getFirestore();
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return null;
  }
}

/**
 * Check if puzzle exists for a given date
 */
async function checkPuzzleExists(date) {
  const db = initFirebase();
  
  if (!db) {
    console.log('PUZZLE_EXISTS=false');
    return false;
  }
  
  try {
    const puzzleRef = db.collection('puzzles').doc(date);
    const doc = await puzzleRef.get();
    
    if (doc.exists) {
      console.log(`✅ Puzzle for ${date} already exists in Firebase`);
      console.log('PUZZLE_EXISTS=true');
      return true;
    } else {
      console.log(`📭 No puzzle found for ${date}`);
      console.log('PUZZLE_EXISTS=false');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking puzzle:', error.message);
    console.log('PUZZLE_EXISTS=false');
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse date argument
  let targetDate;
  const dateArg = args.find(arg => arg.startsWith('--date='))?.split('=')[1] ||
                  (args.includes('--date') ? args[args.indexOf('--date') + 1] : null);
  
  if (dateArg) {
    targetDate = dateArg;
  } else {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    targetDate = tomorrow.toISOString().split('T')[0];
  }
  
  console.log(`🔍 Checking if puzzle exists for: ${targetDate}`);
  
  const exists = await checkPuzzleExists(targetDate);
  
  // Exit with appropriate code (0 = exists, 1 = doesn't exist)
  process.exit(exists ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  console.log('PUZZLE_EXISTS=false');
  process.exit(1);
});
