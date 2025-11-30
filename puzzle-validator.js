/**
 * Puzzle Validation and Duplicate Detection
 * Ensures no repeated words or similar puzzles
 */

/**
 * Get all words used in existing puzzles
 */
export function getAllUsedWords(existingPuzzles) {
  const usedWords = new Set();
  const wordsByDate = {};
  
  existingPuzzles.forEach(puzzle => {
    wordsByDate[puzzle.date] = new Set(puzzle.words);
    puzzle.words.forEach(word => usedWords.add(word.toLowerCase()));
  });
  
  return { usedWords, wordsByDate };
}

/**
 * Get all group explanations used
 */
export function getAllUsedExplanations(existingPuzzles) {
  const usedExplanations = new Set();
  
  existingPuzzles.forEach(puzzle => {
    puzzle.groups.forEach(group => {
      usedExplanations.add(group.explanation.toLowerCase());
    });
  });
  
  return usedExplanations;
}

/**
 * Check if puzzle has duplicate words with existing puzzles
 */
export function checkForDuplicateWords(newPuzzle, existingPuzzles) {
  const { usedWords, wordsByDate } = getAllUsedWords(existingPuzzles);
  const duplicates = [];
  
  newPuzzle.words.forEach(word => {
    const wordLower = word.toLowerCase();
    if (usedWords.has(wordLower)) {
      // Find which puzzle(s) used this word
      const foundIn = Object.entries(wordsByDate)
        .filter(([date, words]) => words.has(word))
        .map(([date]) => date);
      
      duplicates.push({
        word: word,
        usedIn: foundIn
      });
    }
  });
  
  return duplicates;
}

/**
 * Check if explanation is too similar to existing ones
 */
export function checkForSimilarExplanations(newPuzzle, existingPuzzles) {
  const usedExplanations = getAllUsedExplanations(existingPuzzles);
  const similar = [];
  
  newPuzzle.groups.forEach(group => {
    const explanationLower = group.explanation.toLowerCase();
    if (usedExplanations.has(explanationLower)) {
      similar.push(group.explanation);
    }
  });
  
  return similar;
}

/**
 * Check if this exact puzzle already exists
 */
export function checkForExactDuplicate(newPuzzle, existingPuzzles) {
  return existingPuzzles.find(puzzle => {
    if (puzzle.date === newPuzzle.date) {
      return true;
    }
    
    // Check if word sets are identical
    const existingWords = new Set(puzzle.words.map(w => w.toLowerCase()));
    const newWords = new Set(newPuzzle.words.map(w => w.toLowerCase()));
    
    if (existingWords.size === newWords.size) {
      const allMatch = [...newWords].every(word => existingWords.has(word));
      if (allMatch) {
        return true;
      }
    }
    
    return false;
  });
}

/**
 * Get statistics about word usage
 */
export function getWordUsageStats(existingPuzzles) {
  const wordCount = {};
  const totalPuzzles = existingPuzzles.length;
  
  existingPuzzles.forEach(puzzle => {
    puzzle.words.forEach(word => {
      const wordLower = word.toLowerCase();
      wordCount[wordLower] = (wordCount[wordLower] || 0) + 1;
    });
  });
  
  // Find most reused words
  const reusedWords = Object.entries(wordCount)
    .filter(([word, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
  
  return {
    totalWords: Object.keys(wordCount).length,
    totalPuzzles,
    reusedWords: reusedWords.slice(0, 10),
    averageWordsPerPuzzle: totalPuzzles > 0 ? (totalPuzzles * 16) / totalPuzzles : 0
  };
}

/**
 * Main validation function
 */
export function validatePuzzleUniqueness(newPuzzle, existingPuzzles, options = {}) {
  const {
    allowWordReuse = false,  // Set to true to allow words to be reused
    allowSimilarExplanations = true,
    verbose = true
  } = options;
  
  const results = {
    valid: true,
    warnings: [],
    errors: [],
    info: []
  };
  
  // Check for exact duplicate
  const exactDuplicate = checkForExactDuplicate(newPuzzle, existingPuzzles);
  if (exactDuplicate) {
    results.valid = false;
    results.errors.push(`Exact duplicate of puzzle from ${exactDuplicate.date}`);
    return results;
  }
  
  // Check for duplicate words
  const duplicateWords = checkForDuplicateWords(newPuzzle, existingPuzzles);
  if (duplicateWords.length > 0) {
    if (!allowWordReuse) {
      results.valid = false;
      duplicateWords.forEach(({ word, usedIn }) => {
        results.errors.push(`Word "${word}" already used in: ${usedIn.join(', ')}`);
      });
    } else {
      results.warnings.push(`${duplicateWords.length} word(s) reused from previous puzzles`);
    }
  } else {
    results.info.push('✅ No duplicate words found');
  }
  
  // Check for similar explanations
  const similarExplanations = checkForSimilarExplanations(newPuzzle, existingPuzzles);
  if (similarExplanations.length > 0) {
    if (!allowSimilarExplanations) {
      results.valid = false;
      similarExplanations.forEach(exp => {
        results.errors.push(`Explanation already used: "${exp}"`);
      });
    } else {
      results.warnings.push(`${similarExplanations.length} similar explanation(s) found`);
    }
  } else {
    results.info.push('✅ All explanations are unique');
  }
  
  return results;
}

/**
 * Display validation results
 */
export function displayValidationResults(results) {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 UNIQUENESS CHECK');
  console.log('='.repeat(60));
  
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(error => console.log(`   ${error}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(warning => console.log(`   ${warning}`));
  }
  
  if (results.info.length > 0) {
    console.log('\n✅ INFO:');
    results.info.forEach(info => console.log(`   ${info}`));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(results.valid ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED');
  console.log('='.repeat(60));
  
  return results.valid;
}

/**
 * Suggest alternative words (simple implementation)
 */
export function suggestAlternativeWords(duplicateWords) {
  // This could be enhanced with a Hebrew word database
  console.log('\n💡 Suggestions:');
  console.log('   - Edit the puzzle manually in puzzles.json');
  console.log('   - Regenerate the puzzle for a different date');
  console.log('   - Use the AI generator with a different prompt');
}

