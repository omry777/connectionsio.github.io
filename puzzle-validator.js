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
 * Check if any group in the new puzzle overlaps too much with a previous group
 * Returns groups that have 3+ words in common with a previous group (essentially duplicated groups)
 */
export function checkForDuplicateGroups(newPuzzle, existingPuzzles, minOverlap = 3) {
  const duplicateGroups = [];
  
  // Build a map of all previous groups with their words (as lowercase Sets)
  const previousGroups = [];
  existingPuzzles.forEach(puzzle => {
    puzzle.groups.forEach(group => {
      previousGroups.push({
        date: puzzle.date,
        explanation: group.explanation,
        words: new Set(group.words.map(w => w.toLowerCase()))
      });
    });
  });
  
  // Check each group in the new puzzle
  newPuzzle.groups.forEach((newGroup, groupIndex) => {
    const newGroupWords = new Set(newGroup.words.map(w => w.toLowerCase()));
    
    // Compare against all previous groups
    for (const prevGroup of previousGroups) {
      // Count overlapping words
      const overlap = [...newGroupWords].filter(word => prevGroup.words.has(word));
      
      if (overlap.length >= minOverlap) {
        duplicateGroups.push({
          groupIndex,
          newGroupExplanation: newGroup.explanation,
          newGroupWords: newGroup.words,
          previousDate: prevGroup.date,
          previousExplanation: prevGroup.explanation,
          overlappingWords: overlap,
          overlapCount: overlap.length
        });
      }
    }
  });
  
  return duplicateGroups;
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
 * 
 * Validation rules:
 * - Fails if puzzle is an exact duplicate (same date or identical words)
 * - Fails if any group has 3+ words that were in the SAME group in a previous puzzle
 * - Individual word reuse across DIFFERENT groups is allowed (just a warning)
 * - Similar explanations are allowed (just a warning)
 */
export function validatePuzzleUniqueness(newPuzzle, existingPuzzles, options = {}) {
  const {
    allowWordReuse = true,   // Individual word reuse is now allowed by default
    allowSimilarExplanations = true,
    minGroupOverlap = 3,     // Fail if a group has this many words from a previous group
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
  
  // Check for duplicate groups (3+ words from the same previous group)
  const duplicateGroups = checkForDuplicateGroups(newPuzzle, existingPuzzles, minGroupOverlap);
  if (duplicateGroups.length > 0) {
    results.valid = false;
    duplicateGroups.forEach(({ groupIndex, newGroupExplanation, overlappingWords, previousDate, previousExplanation, overlapCount }) => {
      results.errors.push(
        `Group "${newGroupExplanation}" has ${overlapCount}/4 words from group "${previousExplanation}" (${previousDate}): [${overlappingWords.join(', ')}]`
      );
    });
  } else {
    results.info.push('✅ All groups are unique (no group has 3+ words from a previous group)');
  }
  
  // Check for individual duplicate words (warning only, not an error)
  const duplicateWords = checkForDuplicateWords(newPuzzle, existingPuzzles);
  if (duplicateWords.length > 0) {
    if (!allowWordReuse) {
      // Strict mode: fail on any word reuse
      results.valid = false;
      duplicateWords.forEach(({ word, usedIn }) => {
        results.errors.push(`Word "${word}" already used in: ${usedIn.join(', ')}`);
      });
    } else {
      // Normal mode: just warn about word reuse
      results.warnings.push(`${duplicateWords.length} word(s) reused from previous puzzles (spread across different groups - OK)`);
      if (verbose) {
        duplicateWords.slice(0, 5).forEach(({ word, usedIn }) => {
          results.warnings.push(`   - "${word}" was in: ${usedIn.join(', ')}`);
        });
        if (duplicateWords.length > 5) {
          results.warnings.push(`   ... and ${duplicateWords.length - 5} more`);
        }
      }
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

