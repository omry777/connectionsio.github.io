import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, collectionGroup, addDoc, doc, getDoc, setDoc, increment, query, orderBy, limit, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { analytics } from './analytics.js?v=3';
import { puzzleGenerator } from './puzzleGenerator.js';

// Get Firebase Auth UID (set after anonymous sign-in)
let firebaseUserId = null;

// Legacy local user ID (for analytics only, not for Firebase)
function getLocalUserId() {
  let userId = localStorage.getItem('connections_user_id');
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('connections_user_id', userId);
  }
  return userId;
}

const localUserId = getLocalUserId();

// Nickname management
function getNickname() {
  return localStorage.getItem('connections_nickname');
}

function setNickname(nickname) {
  localStorage.setItem('connections_nickname', nickname);
  updateNicknameDisplay();
  
  // Also save to Firebase for centralized nickname lookup
  saveNicknameToFirebase(nickname);
}

// Save nickname to Firebase users collection
async function saveNicknameToFirebase(nickname) {
  if (!db) return;
  
  const authReady = await waitForAuth(5000);
  if (!authReady) return;
  
  try {
    const userRef = doc(db, 'users', firebaseUserId);
    await setDoc(userRef, {
      nickname: nickname,
      updatedAt: new Date()
    }, { merge: true });
    console.log('Nickname saved to Firebase');
  } catch (error) {
    console.log('Could not save nickname to Firebase:', error);
  }
}

function generateRandomNickname() {
  const adjectives = ['שמח', 'חכם', 'מהיר', 'אמיץ', 'חזק', 'נמר', 'נשר', 'אריה', 'זריז', 'גיבור', 'קסום', 'מבריק'];
  const nouns = ['כוכב', 'ירח', 'שמש', 'ענן', 'רוח', 'גל', 'הר', 'נהר', 'עץ', 'פרח', 'ציפור', 'דג'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
}

// Update nickname display on screen
function updateNicknameDisplay() {
  const nicknameEl = document.getElementById('currentNickname');
  if (nicknameEl) {
    const nickname = getNickname();
    nicknameEl.textContent = nickname || 'הגדר כינוי';
    
    // Add different style if no nickname set
    const displayEl = document.getElementById('nicknameDisplay');
    if (displayEl) {
      if (nickname) {
        displayEl.classList.remove('no-nickname');
      } else {
        displayEl.classList.add('no-nickname');
      }
    }
  }
}

// Edit nickname - show modal
window.editNickname = function() {
  const currentNickname = getNickname() || '';
  
  const modal = document.createElement('div');
  modal.id = 'editNicknameModal';
  modal.className = 'nickname-modal';
  
  modal.innerHTML = `
    <div class="nickname-content hebrew-text">
      <h2>✏️ שנה כינוי</h2>
      <p>הכינוי שלך יופיע בטבלת המובילים</p>
      <input type="text" id="editNicknameInput" class="nickname-input" value="${currentNickname}" placeholder="הכנס כינוי..." maxlength="20" dir="rtl">
      <div class="nickname-buttons">
        <button class="btn btn-primary" id="saveEditNicknameBtn">💾 שמור</button>
        <button class="btn btn-secondary" id="randomEditNicknameBtn">🎲 כינוי אקראי</button>
        <button class="btn btn-ghost" id="cancelEditNicknameBtn">ביטול</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const input = document.getElementById('editNicknameInput');
  const saveBtn = document.getElementById('saveEditNicknameBtn');
  const randomBtn = document.getElementById('randomEditNicknameBtn');
  const cancelBtn = document.getElementById('cancelEditNicknameBtn');
  
  // Focus and select input
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
  
  // Save nickname
  saveBtn.onclick = () => {
    const nickname = input.value.trim();
    if (nickname) {
      setNickname(nickname);
    }
    modal.remove();
  };
  
  // Generate random nickname
  randomBtn.onclick = () => {
    input.value = generateRandomNickname();
  };
  
  // Cancel
  cancelBtn.onclick = () => {
    modal.remove();
  };
  
  // Click outside to close
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
  
  // Enter key to save
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    } else if (e.key === 'Escape') {
      modal.remove();
    }
  };
}

let puzzle = {};
let selectedItems = [];
let currentGroups = [];
let mistakesCount = 0;
let gameStartTime = null;
let gameActive = false;
let isPracticeMode = false; // Track if playing archived puzzle
let currentPuzzleDate = null; // Track the date of the current puzzle
let allPuzzles = []; // Store all puzzles for archive feature
let previousGuesses = new Set(); // Track previous wrong guesses to avoid duplicate penalties
const dots = document.querySelectorAll('.dot');
const totalDots = dots.length;

function markMistake() {
  // Turn the dot red
  let dot = dots[mistakesCount]
  dot.classList.add('red');
  mistakesCount++;

  // Check if all dots are red (game over)
  if (mistakesCount === totalDots) {
    endGame();
  }
}

function endGame(won = false) {
  gameActive = false;
  const timeElapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  
  // If in practice mode (archive puzzle), don't save to main stats but track solved puzzle
  if (isPracticeMode) {
    console.log('Practice mode - not counting in statistics');
    // Record that this archived puzzle was solved (for the checkmark in archive list)
    if (won && currentPuzzleDate) {
      analytics.recordArchivePuzzleSolved(currentPuzzleDate);
      console.log(`Recorded archive puzzle solved: ${currentPuzzleDate}`);
    }
    const stats = analytics.getStats();
    finishEndGame(won, stats, timeElapsed, true); // treat as "replay"
    return;
  }
  
  // Check if user already played today - only count FIRST attempt
  const alreadyPlayedToday = analytics.hasPlayedToday();
  
  // Record game result locally (only first attempt)
  let stats;
  if (!alreadyPlayedToday) {
    stats = analytics.recordGameEnd(won, mistakesCount, timeElapsed);
    
    // Check if user has a nickname, if not prompt for one before saving
    if (!getNickname()) {
      showNicknamePrompt((nickname) => {
        // After nickname is set, save to Firebase
        updateGlobalStats(won, mistakesCount, timeElapsed);
        saveUserGameResult(won, mistakesCount, timeElapsed);
        finishEndGame(won, stats, timeElapsed, alreadyPlayedToday);
      });
    } else {
      // Nickname exists, save directly
      updateGlobalStats(won, mistakesCount, timeElapsed);
      saveUserGameResult(won, mistakesCount, timeElapsed);
      finishEndGame(won, stats, timeElapsed, alreadyPlayedToday);
    }
  } else {
    // For replay, just get existing stats without recording
    stats = analytics.getStats();
    console.log('Replay detected - not counting in statistics');
    finishEndGame(won, stats, timeElapsed, alreadyPlayedToday);
  }
}

function finishEndGame(won, stats, timeElapsed, alreadyPlayedToday) {
  if (won) {
    showVictoryModal(stats, timeElapsed, alreadyPlayedToday);
    if (!alreadyPlayedToday) {
      updateLiveCounter();
    }
  } else {
    // Show the failure modal instead of alert
    setTimeout(() => {
      showFailureModal(alreadyPlayedToday);
      revealSolutions();
    }, 500);
  }
}

function revealSolutions() {
  revealRemainingGroups()
  // Replace with logic to reveal the solution for each group
  console.log('Solutions Revealed');
  // Optionally highlight the correct answers
}

// Example of handling the wrong selection
// document.querySelectorAll('.dot').forEach(dot => {
//   dot.addEventListener('click', () => {
//     markMistake(dot);
//   });
// });

// Load puzzle from Firestore by date
async function loadPuzzleFromFirestore(dateStr) {
  if (!db) {
    console.log('Firestore not available');
    return null;
  }
  
  try {
    const puzzleRef = doc(db, 'puzzles', dateStr);
    const puzzleSnap = await getDoc(puzzleRef);
    
    if (puzzleSnap.exists()) {
      const data = puzzleSnap.data();
      console.log(`Puzzle loaded from Firestore for ${dateStr}`);
      return {
        date: dateStr,
        words: data.words,
        groups: data.groups
      };
    }
    return null;
  } catch (error) {
    console.error('Error loading puzzle from Firestore:', error);
    return null;
  }
}

// Load all past puzzles for archive (only up to today, not future)
async function loadArchivePuzzles() {
  if (!db) {
    console.log('Firestore not available for archive');
    return [];
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const puzzlesRef = collection(db, 'puzzles');
    const q = query(
      puzzlesRef,
      where('date', '<=', today),
      orderBy('date', 'desc'),
      limit(30) // Load last 30 puzzles for archive
    );
    
    const snapshot = await getDocs(q);
    const puzzles = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      puzzles.push({
        date: data.date || docSnap.id,
        words: data.words,
        groups: data.groups
      });
    });
    
    console.log(`Loaded ${puzzles.length} archive puzzles from Firestore`);
    return puzzles;
  } catch (error) {
    console.error('Error loading archive puzzles:', error);
    return [];
  }
}

// Load puzzle based on today's date
async function loadTodaysPuzzle() {
  const today = new Date().toISOString().split('T')[0];
  
  // Set current puzzle date
  currentPuzzleDate = today;
  
  // Reset practice mode
  isPracticeMode = false;
  hideArchiveBanner();
  document.getElementById('game-container')?.classList.remove('practice-mode');
  
  try {
    // Wait for Firebase auth to be ready (needed for Firestore rules)
    await waitForAuth(3000);
    
    // Try to load today's puzzle from Firestore
    puzzle = await loadPuzzleFromFirestore(today);
    
    // If no puzzle for today, generate one as fallback
    if (!puzzle) {
      console.log('No puzzle found in Firestore for today, generating new one...');
      puzzle = puzzleGenerator.generatePuzzle(today);
    }
    
    // Load archive puzzles in the background (for archive feature)
    loadArchivePuzzles().then(puzzles => {
      allPuzzles = puzzles;
      console.log('Archive puzzles loaded:', allPuzzles.length);
    });
    
    if (puzzle) {
      puzzle.groups.forEach((group, index) => {
        group.guessed = false;
        group.index = index;
      });
      
      // Start game timer
      gameStartTime = Date.now();
      gameActive = true;
      
      // Check if already played today
      const todayStats = analytics.getTodayStats();
      if (todayStats) {
        showAlreadyPlayedMessage(todayStats);
      }
      
      shuffleGrid();
      updateStatsDisplay();
      loadGlobalStats();
      
      // Show live counter after a short delay
      setTimeout(() => updateLiveCounter(), 1000);
    } else {
      showNoPuzzleMessage();
    }
  } catch (error) {
    console.error('Error loading puzzle:', error);
    // Fallback to generated puzzle
    puzzle = puzzleGenerator.generatePuzzle(today);
    puzzle.groups.forEach((group, index) => {
      group.guessed = false;
      group.index = index;
    });
    gameStartTime = Date.now();
    gameActive = true;
    shuffleGrid();
  }
}

// Initialize game
loadTodaysPuzzle();
updateNicknameDisplay();

// Sync local nickname to Firebase (for existing users who set nickname before this update)
setTimeout(async () => {
  const localNickname = getNickname();
  if (localNickname && db) {
    const authReady = await waitForAuth(5000);
    if (authReady) {
      // Check if user already has nickname in Firebase
      try {
        const userRef = doc(db, 'users', firebaseUserId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || !userSnap.data().nickname) {
          // Sync local nickname to Firebase
          saveNicknameToFirebase(localNickname);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }
}, 2000);

// Load puzzle words into grid
function loadPuzzle() {
  const grid = document.getElementById('grid');
  grid.innerHTML = ''; // Clear grid
  puzzle.words.forEach( word => {
        const item = document.createElement('div');
        item.classList.add('grid-item');
        item.textContent = word;
        item.onclick = () => toggleSelection(item, word);
        grid.appendChild(item);
        });
//   shuffleGrid()
}

// Handle selection toggle
function toggleSelection(item, word) {
  if (selectedItems.includes(word)) {
    selectedItems = selectedItems.filter(w => w !== word);
    item.classList.remove('selected');
  } else if (selectedItems.length < 4) {
    selectedItems.push(word);
    item.classList.add('selected');
  }

  if (selectedItems.length === 4) {
    checkGroup();
  }
}

// Check if selected items form a valid group
function checkGroup() {
  // Create a unique key for this guess (sorted to ensure consistent ordering)
  const guessKey = [...selectedItems].sort().join('|');
  
  // Check if this exact guess was already made
  if (previousGuesses.has(guessKey)) {
    showInfoBanner('כבר ניחשת את המילים האלו.');
    deselectAll();
    selectedItems = [];
    return; // Don't count as mistake
  }
  
  const matchedGroup = puzzle.groups.find(group =>
    group.words.every(word => selectedItems.includes(word))
  );

  if (matchedGroup) {
    matchedGroup.guessed = true;
    highlightGroup(matchedGroup);
    removeMatchedWords(matchedGroup.words);
    renderGroups(matchedGroup);
    
    // Show explanation with animation
    showGroupExplanation(matchedGroup);
    
    // Check if all groups are found
    const allGuessed = puzzle.groups.every(g => g.guessed);
    if (allGuessed) {
      setTimeout(() => endGame(true), 1000);
    }
  } else {
    // Add to previous guesses (only wrong guesses)
    previousGuesses.add(guessKey);
    
    // Check if 3 out of 4 words match any group (one away!)
    const isOneAway = puzzle.groups.some(group => {
      if (group.guessed) return false; // Skip already guessed groups
      const matchCount = group.words.filter(word => selectedItems.includes(word)).length;
      return matchCount === 3;
    });
    
    if (isOneAway) {
      showInfoBanner('זה היה ממש קרוב!', 'warning');
    }
    
    showWrongNotification();
    deselectAll();
    markMistake();
  }
  selectedItems = []; // Reset selection
}

// Highlight matched group
function highlightGroup(group) {
  const tiles = document.querySelectorAll('.grid-item');
  tiles.forEach(tile => {
    if (group.words.includes(tile.textContent)) {
      tile.style.backgroundColor = group.color;
      tile.style.color = 'white';
      tile.style.pointerEvents = 'none'; // Disable clicks on matched tiles
    }
  });
}

// Remove matched words from the puzzle
function removeMatchedWords(words) {
  puzzle.words = puzzle.words.filter(word => !words.includes(word));
  loadPuzzle(); // Reload grid with remaining words
}

function removeMatchedGroup(group) {
  const groupContainer = document.querySelector(`[data-group-id="${group.index}"]`);
  if (groupContainer) {
    groupContainer.classList.add('revealed'); // Optionally, add a "revealed" class for visual effects
    setTimeout(() => {
      groupContainer.remove(); // Remove the group container from the grid
    }, 1000); // Delay to match the reveal transition effect
  }

}

// Render matched groups on the left
function renderGroups(group) {
  const groupsContainer = document.getElementById('revealed-groups');
  const groupElement = document.createElement('div');
  groupElement.classList.add('group');
  groupElement.style.borderColor = group.color;
  groupElement.innerHTML = `
    <p><strong>Group Explanation:</strong> ${group.explanation}</p>
    <div class="group-words">${group.words.join(', ')}</div>
  `;
  groupsContainer.appendChild(groupElement);
}
// Function to reveal the remaining groups at the end of the game
function revealRemainingGroups() {
    const groupsContainer = document.getElementById('revealed-groups');

    // Iterate over all groups and move the unguessed ones to the revealed container
    puzzle.groups.forEach(group => {
      if (!group.guessed) {
        const groupElement = document.createElement('div');
        // group.words.style.backgroundColor = group.color;
        removeMatchedWords(group.words);
        groupElement.classList.add('group');
        groupElement.style.borderColor = group.color;
        groupElement.innerHTML = `
          <p><strong>Group Explanation:</strong> ${group.explanation}</p>
          <div class="group-words">${group.words.join(', ')}</div>
        `;
        groupsContainer.appendChild(groupElement);
        }
        
    })
}

// Shuffle grid
window.shuffleGrid = function() {
    puzzle.words.sort(() => Math.random() - 0.5);
    loadPuzzle();
}

window.reopenForm = function() {
    document.getElementById("suggestForm").classList.remove("hidden");
    document.getElementById("successSubmitMessage").classList.remove("show");
};

// Deselect all items
window.deselectAll = function() {
  selectedItems = [];
  document.querySelectorAll('.grid-item').forEach(item => {
    item.classList.remove('selected');
  });
}

// Show group explanation with animation
function showGroupExplanation(group) {
  const notification = document.createElement('div');
  notification.className = 'group-notification';
  notification.style.backgroundColor = group.color;
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-title">נכון מאוד! 🎉</div>
      <div class="notification-explanation">${group.explanation}</div>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Show wrong answer notification (instead of alert)
function showWrongNotification() {
  const existing = document.querySelector('.wrong-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'wrong-notification';
  notification.innerHTML = `
    <div>❌ זו לא הקבוצה עליה חשבנו</div>
    <div style="font-size: 14px; margin-top: 5px;">נסה שוב!</div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Show info banner (for "one away" and "already guessed" messages)
function showInfoBanner(message, type = 'info') {
  const existing = document.querySelector('.info-banner');
  if (existing) existing.remove();
  
  const banner = document.createElement('div');
  banner.className = `info-banner info-banner-${type}`;
  banner.innerHTML = `<div class="hebrew-text">${message}</div>`;
  document.body.appendChild(banner);
  
  setTimeout(() => banner.classList.add('show'), 10);
  setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  }, 2500);
}

// Show failure modal (instead of alert)
function showFailureModal(isReplay = false) {
  const modal = document.getElementById('failureModal') || createFailureModal();
  
  let replayBanner = '';
  if (isPracticeMode) {
    replayBanner = `
      <div class="replay-notice hebrew-text" style="background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.3);">
        📅 מצב תרגול - חידה מהארכיון
      </div>
    `;
  } else if (isReplay) {
    replayBanner = `
      <div class="replay-notice hebrew-text">
        🔄 משחק חוזר - לא נספר בסטטיסטיקה
      </div>
    `;
  }
  
  const practiceActions = isPracticeMode ? `
    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
      <button class="btn btn-light" onclick="document.getElementById('failureModal').style.display='none'; returnToDailyPuzzle();">
        ⬅️ חזרה לחידה היומית
      </button>
      <button class="btn btn-warning" onclick="document.getElementById('failureModal').style.display='none'; showArchiveModal();" style="margin-right: 10px;">
        📅 עוד חידות מהארכיון
      </button>
    </div>
  ` : '';
  
  const encouragementText = isPracticeMode 
    ? 'אפשר לנסות חידה נוספת מהארכיון!' 
    : 'אל דאגה, מחר יש חידה חדשה!';
  
  modal.querySelector('.failure-content').innerHTML = `
    <h2 class="hebrew-text">😔 הפעם לא הצלחנו</h2>
    ${replayBanner}
    <p class="hebrew-text">${encouragementText}</p>
    <p class="hebrew-text" style="font-size: 14px; opacity: 0.8;">הקבוצות שנותרו יוצגו למטה</p>
    <div style="margin-top: 25px;">
      <button class="btn btn-light" onclick="document.getElementById('failureModal').style.display='none'; showStatsModal();">
        📊 הצג סטטיסטיקות
      </button>
      <button class="btn btn-warning" onclick="document.getElementById('failureModal').style.display='none';">
        👀 צפה בפתרונות
      </button>
    </div>
    ${practiceActions}
  `;
  modal.style.display = 'flex';
}

// Create failure modal if it doesn't exist
function createFailureModal() {
  const modal = document.createElement('div');
  modal.id = 'failureModal';
  modal.className = 'failure-modal';
  modal.innerHTML = '<div class="failure-content"></div>';
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  return modal;
}

// Show no puzzle available message (instead of alert)
function showNoPuzzleMessage() {
  const container = document.querySelector('.container');
  const message = document.createElement('div');
  message.className = 'already-played-message hebrew-text';
  message.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  message.innerHTML = `
    <h3>🎮 אין חידה להיום</h3>
    <p>החידות החדשות מתעדכנות מדי יום!</p>
    <p style="font-size: 14px; opacity: 0.8;">נסה לחזור מחר או בדוק את החיבור לאינטרנט</p>
    <button class="btn btn-light" onclick="location.reload()">🔄 נסה שוב</button>
  `;
  container.prepend(message);
}

// Show nickname prompt modal
function showNicknamePrompt(callback) {
  const modal = document.createElement('div');
  modal.id = 'nicknameModal';
  modal.className = 'nickname-modal';
  
  const randomNick = generateRandomNickname();
  
  modal.innerHTML = `
    <div class="nickname-content hebrew-text">
      <h2>🏆 הכנס כינוי לטבלת המובילים</h2>
      <p>השם שלך יופיע בלידרבורד!</p>
      <input type="text" id="nicknameInput" class="nickname-input" placeholder="הכנס כינוי..." maxlength="20" dir="rtl">
      <div class="nickname-buttons">
        <button class="btn btn-primary" id="saveNicknameBtn">💾 שמור</button>
        <button class="btn btn-secondary" id="randomNicknameBtn">🎲 כינוי אקראי</button>
        <button class="btn btn-ghost" id="skipNicknameBtn">דלג (אנונימי)</button>
      </div>
      <p class="nickname-hint">* ניתן לשנות בהמשך בהגדרות</p>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const input = document.getElementById('nicknameInput');
  const saveBtn = document.getElementById('saveNicknameBtn');
  const randomBtn = document.getElementById('randomNicknameBtn');
  const skipBtn = document.getElementById('skipNicknameBtn');
  
  // Focus input
  setTimeout(() => input.focus(), 100);
  
  // Save nickname
  saveBtn.onclick = () => {
    const nickname = input.value.trim() || 'אנונימי';
    setNickname(nickname);
    modal.remove();
    callback(nickname);
  };
  
  // Generate random nickname
  randomBtn.onclick = () => {
    input.value = generateRandomNickname();
  };
  
  // Skip - use anonymous
  skipBtn.onclick = () => {
    setNickname('אנונימי');
    modal.remove();
    callback('אנונימי');
  };
  
  // Enter key to save
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  };
}

// Show victory modal
function showVictoryModal(stats, timeElapsed, isReplay = false) {
  const modal = document.getElementById('victoryModal') || createVictoryModal();
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  
  let replayBanner = '';
  if (isPracticeMode) {
    replayBanner = `
      <div class="replay-notice hebrew-text" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(124, 58, 237, 0.2)); border-color: rgba(168, 85, 247, 0.5);">
        📅 מצב תרגול - חידה מהארכיון
      </div>
    `;
  } else if (isReplay) {
    replayBanner = `
      <div class="replay-notice hebrew-text">
        🔄 משחק חוזר - לא נספר בסטטיסטיקה
      </div>
    `;
  }
  
  const practiceButtons = isPracticeMode ? `
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
      <button class="btn btn-secondary" onclick="document.getElementById('victoryModal').style.display='none'; returnToDailyPuzzle();">
        ⬅️ חזרה לחידה היומית
      </button>
      <button class="btn btn-secondary" onclick="document.getElementById('victoryModal').style.display='none'; showArchiveModal();" style="margin-right: 10px;">
        📅 עוד חידות מהארכיון
      </button>
    </div>
  ` : '';
  
  modal.querySelector('.victory-content').innerHTML = `
    <h2 class="hebrew-text">🎉 כל הכבוד! 🎉</h2>
    ${replayBanner}
    <div class="victory-stats hebrew-text">
      <div class="stat-item">
        <div class="stat-value">${mistakesCount}</div>
        <div class="stat-label">טעויות</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</div>
        <div class="stat-label">זמן</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.currentStreak}</div>
        <div class="stat-label">רצף נוכחי</div>
      </div>
    </div>
    <div class="share-section hebrew-text">
      ${!isPracticeMode ? '<button class="btn btn-primary" onclick="shareResults()">שתף תוצאות</button>' : ''}
      <button class="btn btn-secondary" onclick="showStatsModal()">סטטיסטיקות</button>
    </div>
    ${practiceButtons}
  `;
  modal.style.display = 'flex';
}

// Create victory modal if it doesn't exist
function createVictoryModal() {
  const modal = document.createElement('div');
  modal.id = 'victoryModal';
  modal.className = 'victory-modal';
  modal.innerHTML = '<div class="victory-content"></div>';
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  return modal;
}

// Share results
window.shareResults = function() {
  const emoji = mistakesCount === 0 ? '🌟' : mistakesCount <= 2 ? '✨' : '💪';
  const text = `Connections ${emoji}\nטעויות: ${mistakesCount}/4\nרצף: ${analytics.getStats().currentStreak} ימים`;
  
  if (navigator.share) {
    navigator.share({ text, url: window.location.href });
  } else {
    navigator.clipboard.writeText(text);
    alert('התוצאות הועתקו ללוח!');
  }
}

// Show statistics modal
window.showStatsModal = function() {
  const modal = document.getElementById('statsModal') || createStatsModal();
  updateStatsModalContent();
  modal.style.display = 'flex';
}

// Create stats modal
function createStatsModal() {
  const modal = document.createElement('div');
  modal.id = 'statsModal';
  modal.className = 'stats-modal';
  modal.innerHTML = `
    <div class="stats-modal-content">
      <span class="close-modal" onclick="document.getElementById('statsModal').style.display='none'">&times;</span>
      <div id="statsModalBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  return modal;
}

// Update stats modal content
async function updateStatsModalContent() {
  const stats = analytics.getStats();
  const distribution = analytics.getResultsDistribution();
  const recentGames = analytics.getRecentGames();
  
  const modalBody = document.getElementById('statsModalBody');
  modalBody.innerHTML = `
    <h2 class="hebrew-text">הסטטיסטיקות שלך 📊</h2>
    <div class="stats-grid hebrew-text">
      <div class="stat-box">
        <div class="stat-number">${stats.gamesPlayed}</div>
        <div class="stat-title">משחקים</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.winRate}%</div>
        <div class="stat-title">אחוז הצלחה</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.currentStreak}</div>
        <div class="stat-title">רצף נוכחי</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.maxStreak}</div>
        <div class="stat-title">רצף מקסימלי</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.averageMistakes}</div>
        <div class="stat-title">ממוצע טעויות</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${stats.perfectGames}</div>
        <div class="stat-title">משחקים מושלמים</div>
      </div>
    </div>
    
    <h3 class="hebrew-text">התפלגות תוצאות</h3>
    <div class="distribution-chart hebrew-text">
      ${[0, 1, 2, 3, 4].map(i => `
        <div class="distribution-row">
          <div class="distribution-label">${i} טעויות</div>
          <div class="distribution-bar">
            <div class="bar-fill" style="width: ${stats.gamesPlayed > 0 ? (distribution[i] / stats.gamesPlayed * 100) : 0}%">
              ${distribution[i]}
            </div>
          </div>
        </div>
      `).join('')}
      <div class="distribution-row">
        <div class="distribution-label">נכשל</div>
        <div class="distribution-bar">
          <div class="bar-fill failed" style="width: ${stats.gamesPlayed > 0 ? (distribution.failed / stats.gamesPlayed * 100) : 0}%">
            ${distribution.failed}
          </div>
        </div>
      </div>
    </div>
    
    <div id="globalStatsSection" class="global-stats-section hebrew-text">
      <h3>📈 סטטיסטיקות גלובליות - היום</h3>
      <div id="globalStatsContent">טוען...</div>
    </div>
    
    <div id="leaderboardSection" class="leaderboard-section hebrew-text">
      <h3>🏆 טבלת המובילים היום</h3>
      <div id="leaderboardContent">טוען...</div>
    </div>
  `;
  
  // Load data asynchronously after modal content is created
  loadGlobalStatsContent();
  loadLeaderboardContent();
}

// Load and render leaderboard content
async function loadLeaderboardContent() {
  const leaderboard = await loadTodayLeaderboard();
  const leaderboardContent = document.getElementById('leaderboardContent');
  
  if (!leaderboardContent) return;
  
  if (leaderboard.length === 0) {
    leaderboardContent.innerHTML = '<p style="text-align: center; color: #666;">אין עדיין תוצאות להיום</p>';
    return;
  }
  
  const getMedal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  leaderboardContent.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>דירוג</th>
          <th>שם</th>
          <th>טעויות</th>
          <th>זמן</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboard.map(entry => `
          <tr class="${entry.rank <= 3 ? 'rank-' + entry.rank : ''} ${entry.isCurrentUser ? 'current-user' : ''}">
            <td><span class="medal">${getMedal(entry.rank)}</span></td>
            <td class="nickname-cell">${entry.nickname}${entry.isCurrentUser ? ' <small>(אתה!)</small>' : ''}</td>
            <td>${entry.mistakes}</td>
            <td>${formatTime(entry.time)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Load global stats content for the modal
async function loadGlobalStatsContent() {
  const globalStatsContent = document.getElementById('globalStatsContent');
  if (!globalStatsContent) return;
  
  if (!db) {
    globalStatsContent.innerHTML = '<p style="text-align: center; color: #666;">Firebase לא מוגדר</p>';
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, 'dailyStats', today);
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      const data = statsSnap.data();
      const totalPlays = data.totalPlays || 0;
      const totalWins = data.totalWins || 0;
      const totalMistakes = data.totalMistakes || 0;
      const totalTime = data.totalTime || 0;
      const avgTime = totalWins > 0 ? Math.floor(totalTime / totalWins) : 0;
      const avgMins = Math.floor(avgTime / 60);
      const avgSecs = avgTime % 60;
      
      globalStatsContent.innerHTML = `
        <div class="stats-chart">
          <div class="chart-bar-container">
            <div class="chart-label">שיחקו:</div>
            <div style="font-weight: bold; font-size: 24px; color: #667eea;">${totalPlays}</div>
          </div>
          <div class="chart-bar-container">
            <div class="chart-label">הצליחו:</div>
            <div style="font-weight: bold; font-size: 24px; color: #4caf50;">${totalWins}</div>
            <div style="color: #666; margin-right: 10px;">(${totalPlays > 0 ? Math.round((totalWins / totalPlays) * 100) : 0}%)</div>
          </div>
          <div class="chart-bar-container">
            <div class="chart-label">ממוצע טעויות:</div>
            <div style="font-weight: bold; font-size: 20px; color: #f44336;">${totalPlays > 0 ? (totalMistakes / totalPlays).toFixed(1) : 0}</div>
          </div>
          <div class="chart-bar-container">
            <div class="chart-label">זמן ממוצע:</div>
            <div style="font-weight: bold; font-size: 20px; color: #ff9800;">${avgMins}:${avgSecs.toString().padStart(2, '0')}</div>
          </div>
        </div>
      `;
    } else {
      globalStatsContent.innerHTML = '<p style="text-align: center; color: #666;">אין עדיין נתונים להיום</p>';
    }
  } catch (error) {
    console.log('Could not load global stats for modal:', error);
    globalStatsContent.innerHTML = '<p style="text-align: center; color: #666;">שגיאה בטעינת הנתונים</p>';
  }
}

// Update stats display in main UI
function updateStatsDisplay() {
  const stats = analytics.getStats();
  const statsBtn = document.getElementById('statsButton');
  if (statsBtn) {
    statsBtn.innerHTML = `📊 סטטיסטיקות <span class="badge">${stats.currentStreak}</span>`;
  }
}

// Show already played message
function showAlreadyPlayedMessage(todayStats) {
  const message = document.createElement('div');
  message.className = 'already-played-message hebrew-text';
  message.innerHTML = `
    <p>כבר שיחקת היום!</p>
    <p>תוצאה: ${todayStats.won ? '✅ ניצחון' : '❌ נכשל'}</p>
    <p>טעויות: ${todayStats.mistakes}</p>
    <button class="btn btn-primary" onclick="this.parentElement.remove(); showStatsModal()">
      הצג סטטיסטיקות
    </button>
  `;
  document.querySelector('.container').prepend(message);
}

// Wait for Firebase Auth to be ready (with timeout)
async function waitForAuth(maxWaitMs = 5000) {
  if (firebaseUserId) return true;
  
  const startTime = Date.now();
  while (!firebaseUserId && (Date.now() - startTime) < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return !!firebaseUserId;
}

// Update global statistics in Firebase
async function updateGlobalStats(won, mistakes, timeElapsed = 0) {
  if (!db) {
    console.log('Firebase not configured - skipping global stats update');
    return;
  }
  
  // Wait for auth (rules require request.auth != null)
  const authReady = await waitForAuth(5000);
  if (!authReady) {
    console.log('Auth timeout - could not update global stats');
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, 'dailyStats', today);
    
    await setDoc(statsRef, {
      totalPlays: increment(1),
      totalWins: increment(won ? 1 : 0),
      totalMistakes: increment(mistakes),
      totalTime: increment(timeElapsed),
      lastUpdated: new Date()
    }, { merge: true });
    console.log('Global stats updated successfully');
  } catch (error) {
    console.log('Could not update global stats:', error);
  }
}

// Save individual user game result to Firebase
async function saveUserGameResult(won, mistakes, timeElapsed) {
  if (!db) {
    console.log('Firebase not configured - skipping user stats save');
    return;
  }
  
  // Wait for auth to complete (up to 5 seconds)
  const authReady = await waitForAuth(5000);
  if (!authReady) {
    console.log('Auth timeout - could not save user stats');
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    // Path: userDailyGames/{uid}/days/{date} - matches security rules
    const userGameRef = doc(db, 'userDailyGames', firebaseUserId, 'days', today);
    
    const nickname = getNickname() || 'אנונימי';
    
    await setDoc(userGameRef, {
      date: today,
      odataUri: firebaseUserId,
      nickname: nickname,
      won: won,
      mistakes: mistakes,
      timeElapsed: timeElapsed,
      timestamp: new Date(),
      // Calculate score: lower is better (mistakes * 100 + time)
      score: (mistakes * 1000) + timeElapsed
    });
    console.log('User game result saved successfully to:', userGameRef.path);
  } catch (error) {
    console.log('Could not save user game result:', error);
  }
}

// Create live counter badge (small, next to stats button)
function createLiveCounter() {
  const statsButton = document.getElementById('statsButton');
  if (!statsButton) return null;
  
  // Create wrapper for button + badge
  let wrapper = statsButton.parentElement.querySelector('.stats-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'stats-wrapper';
    statsButton.parentElement.insertBefore(wrapper, statsButton);
    wrapper.appendChild(statsButton);
  }
  
  const badge = document.createElement('div');
  badge.id = 'liveCounter';
  badge.className = 'live-counter-badge';
  badge.innerHTML = `<span id="successCount">0</span>`;
  badge.title = 'אנשים שהצליחו היום';
  wrapper.appendChild(badge);
  
  return badge;
}

// Update live counter
async function updateLiveCounter() {
  if (!db) return;
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, 'dailyStats', today);
    const statsSnap = await getDoc(statsRef);
    
    let counter = document.getElementById('liveCounter') || createLiveCounter();
    if (!counter) return;
    
    if (statsSnap.exists()) {
      const data = statsSnap.data();
      const successCount = data.totalWins || 0;
      if (successCount > 0) {
        document.getElementById('successCount').textContent = successCount;
        counter.classList.add('visible');
      }
    }
  } catch (error) {
    console.log('Could not update live counter:', error);
  }
}

// Load today's leaderboard
async function loadTodayLeaderboard() {
  if (!db) {
    return [];
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    // Use collectionGroup to query across all users' "days" subcollections
    const daysRef = collectionGroup(db, 'days');
    const q = query(
      daysRef,
      where('date', '==', today),
      where('won', '==', true),
      orderBy('score', 'asc'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    const entries = [];
    const userIds = new Set();
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Get the user ID from the document path: userDailyGames/{uid}/days/{date}
      const pathParts = docSnap.ref.path.split('/');
      const odataUri = pathParts[1]; // The uid part
      userIds.add(odataUri);
      
      entries.push({
        odataUri: odataUri,
        mistakes: data.mistakes,
        time: data.timeElapsed,
        score: data.score,
        fallbackNickname: data.nickname || 'אנונימי' // Use as fallback
      });
    });
    
    // Fetch nicknames from users collection (centralized)
    const nicknameMap = await fetchNicknames(Array.from(userIds));
    
    // Build final leaderboard with centralized nicknames
    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      odataUri: entry.odataUri,
      nickname: nicknameMap[entry.odataUri] || entry.fallbackNickname,
      mistakes: entry.mistakes,
      time: entry.time,
      score: entry.score,
      isCurrentUser: entry.odataUri === firebaseUserId
    }));
    
    return leaderboard;
  } catch (error) {
    console.log('Could not load leaderboard:', error);
    return [];
  }
}

// Fetch nicknames from users collection
async function fetchNicknames(userIds) {
  const nicknameMap = {};
  
  if (!db || userIds.length === 0) return nicknameMap;
  
  try {
    // Fetch each user's nickname (Firebase doesn't support "in" query for doc IDs easily)
    const promises = userIds.map(async (odataUri) => {
      try {
        const userRef = doc(db, 'users', odataUri);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          nicknameMap[odataUri] = userSnap.data().nickname;
        }
      } catch (e) {
        // Ignore individual failures
      }
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.log('Could not fetch nicknames:', error);
  }
  
  return nicknameMap;
}

// Load global statistics from Firebase
async function loadGlobalStats() {
  if (!db) {
    console.log('Firebase not configured - skipping global stats load');
    const globalStatsContent = document.getElementById('globalStatsContent');
    if (globalStatsContent) {
      globalStatsContent.innerHTML = '<p class="text-muted">Firebase לא מוגדר</p>';
    }
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, 'dailyStats', today);
    const statsSnap = await getDoc(statsRef);
    
    if (statsSnap.exists()) {
      const data = statsSnap.data();
      const totalPlays = data.totalPlays || 0;
      const totalWins = data.totalWins || 0;
      const totalMistakes = data.totalMistakes || 0;
      const totalTime = data.totalTime || 0;
      const avgTime = totalWins > 0 ? Math.floor(totalTime / totalWins) : 0;
      const avgMins = Math.floor(avgTime / 60);
      const avgSecs = avgTime % 60;
      
      const globalStatsContent = document.getElementById('globalStatsContent');
      if (globalStatsContent) {
        globalStatsContent.innerHTML = `
          <div class="stats-chart">
            <div class="chart-bar-container">
              <div class="chart-label">שיחקו:</div>
              <div style="font-weight: bold; font-size: 24px; color: #667eea;">${totalPlays}</div>
            </div>
            <div class="chart-bar-container">
              <div class="chart-label">הצליחו:</div>
              <div style="font-weight: bold; font-size: 24px; color: #4caf50;">${totalWins}</div>
              <div style="color: #666; margin-right: 10px;">(${totalPlays > 0 ? Math.round((totalWins / totalPlays) * 100) : 0}%)</div>
            </div>
            <div class="chart-bar-container">
              <div class="chart-label">ממוצע טעויות:</div>
              <div style="font-weight: bold; font-size: 20px; color: #f44336;">${totalPlays > 0 ? (totalMistakes / totalPlays).toFixed(1) : 0}</div>
            </div>
            <div class="chart-bar-container">
              <div class="chart-label">זמן ממוצע:</div>
              <div style="font-weight: bold; font-size: 20px; color: #ff9800;">${avgMins}:${avgSecs.toString().padStart(2, '0')}</div>
            </div>
          </div>
        `;
      }
      
      // Also update live counter
      updateLiveCounter();
    } else {
      const globalStatsContent = document.getElementById('globalStatsContent');
      if (globalStatsContent) {
        globalStatsContent.innerHTML = '<p style="text-align: center; color: #666;">אין עדיין נתונים להיום</p>';
      }
    }
  } catch (error) {
    console.log('Could not load global stats:', error);
  }
}

// Initialize Firebase
let app, db, auth;
try {
  // Access firebaseConfig from window object (loaded via script tag)
  const config = window.firebaseConfig;
  if (config && config.apiKey && config.apiKey !== 'YOUR_API_KEY') {
    app = initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    signInAnonymously(auth).catch((err) => {
      console.error("Anon auth failed", err);
    });
    
    onAuthStateChanged(auth, (user) => {
      if (user) {
        firebaseUserId = user.uid;
        console.log("Firebase Auth UID:", firebaseUserId);
      } else {
        firebaseUserId = null;
        console.log("Signed out");
      }
    });
    console.log('Firebase initialized successfully');
  } else {
    console.log('Firebase not configured - using local features only');
  }
} catch (error) {
  console.log('Firebase initialization failed - using local features only:', error);
}
// const database = firebase.database();

// ============================================
// PUZZLE ARCHIVE FEATURE
// ============================================

// Show archive modal
window.showArchiveModal = async function() {
  const modal = document.getElementById('archiveModal');
  const listContainer = document.getElementById('archivePuzzleList');
  
  if (!modal || !listContainer) return;
  
  // Show loading state
  listContainer.innerHTML = `
    <div class="archive-empty">
      <div class="archive-empty-icon">⏳</div>
      <p>טוען חידות מהארכיון...</p>
    </div>
  `;
  
  modal.style.display = 'flex';
  
  // Load archive puzzles if not already loaded
  if (allPuzzles.length === 0) {
    allPuzzles = await loadArchivePuzzles();
  }
  
  // Populate puzzle list
  populateArchiveList(listContainer);
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Populate archive list with all available puzzles
function populateArchiveList(container) {
  const today = new Date().toISOString().split('T')[0];
  
  // Filter out future puzzles and sort by date (newest first)
  const sortedPuzzles = [...allPuzzles]
    .filter(p => p.date <= today) // Only show today and past puzzles
    .sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
  
  if (sortedPuzzles.length === 0) {
    container.innerHTML = `
      <div class="archive-empty">
        <div class="archive-empty-icon">📭</div>
        <p>אין חידות בארכיון עדיין</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = sortedPuzzles.map(p => {
    const isToday = p.date === today;
    const dateObj = new Date(p.date);
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = dayNames[dateObj.getDay()];
    
    // Format date in Hebrew style
    const formattedDate = formatHebrewDate(p.date);
    
    // Check if this puzzle was solved by the user
    const wasSolved = analytics.wasPuzzleSolved(p.date);
    
    return `
      <div class="archive-puzzle-item ${isToday ? 'is-today' : ''}" onclick="loadArchivedPuzzle('${p.date}')">
        <div class="puzzle-date-info">
          <div class="puzzle-date">
            📅 ${formattedDate}
            ${isToday ? '<span class="puzzle-today-badge">היום</span>' : ''}
          </div>
          <div class="puzzle-day-name">יום ${dayName}</div>
        </div>
        ${wasSolved ? '<div class="puzzle-solved-badge">✓</div>' : '<div class="puzzle-play-arrow">◀</div>'}
      </div>
    `;
  }).join('');
}

// Format date in Hebrew-friendly format
function formatHebrewDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDate();
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ב${month} ${year}`;
}

// Load archived puzzle
window.loadArchivedPuzzle = async function(dateString) {
  const today = new Date().toISOString().split('T')[0];
  
  // If selecting today's puzzle, just reload normally
  if (dateString === today) {
    document.getElementById('archiveModal').style.display = 'none';
    returnToDailyPuzzle();
    return;
  }
  
  // Find the puzzle in cache first
  let selectedPuzzle = allPuzzles.find(p => p.date === dateString);
  
  // If not in cache, try to load from Firestore
  if (!selectedPuzzle) {
    console.log(`Puzzle not in cache, loading from Firestore: ${dateString}`);
    selectedPuzzle = await loadPuzzleFromFirestore(dateString);
  }
  
  if (!selectedPuzzle) {
    alert('החידה לא נמצאה');
    return;
  }
  
  // Close modal
  document.getElementById('archiveModal').style.display = 'none';
  
  // Remove any "already played" message
  const alreadyPlayedMsg = document.querySelector('.already-played-message');
  if (alreadyPlayedMsg) {
    alreadyPlayedMsg.remove();
  }
  
  // Set practice mode
  isPracticeMode = true;
  currentPuzzleDate = dateString;
  
  // Reset game state
  resetGameState();
  
  // Load the selected puzzle
  puzzle = JSON.parse(JSON.stringify(selectedPuzzle)); // Deep copy
  puzzle.groups.forEach((group, index) => {
    group.guessed = false;
    group.index = index;
  });
  
  // Show archive banner
  showArchiveBanner(dateString);
  
  // Add practice mode class
  document.getElementById('game-container')?.classList.add('practice-mode');
  
  // Start game
  gameStartTime = Date.now();
  gameActive = true;
  
  shuffleGrid();
  
  console.log(`Loaded archived puzzle from ${dateString} in practice mode`);
}

// Return to daily puzzle
window.returnToDailyPuzzle = function() {
  // Remove any "already played" message that might have been shown
  const alreadyPlayedMsg = document.querySelector('.already-played-message');
  if (alreadyPlayedMsg) {
    alreadyPlayedMsg.remove();
  }
  
  // Reset game state
  resetGameState();
  
  // Reload today's puzzle
  loadTodaysPuzzle();
}

// Reset game state for new puzzle
function resetGameState() {
  selectedItems = [];
  mistakesCount = 0;
  gameActive = false;
  previousGuesses = new Set(); // Reset previous guesses tracking

  // Reset mistake dots
  document.querySelectorAll('.dot').forEach(dot => {
    dot.classList.remove('red');
  });

  // Clear revealed groups
  const revealedGroups = document.getElementById('revealed-groups');
  if (revealedGroups) {
    revealedGroups.innerHTML = '';
  }
  
  // Clear grid
  const grid = document.getElementById('grid');
  if (grid) {
    grid.innerHTML = '';
  }
}

// Show archive banner
function showArchiveBanner(dateString) {
  const banner = document.getElementById('archiveBanner');
  const dateText = document.getElementById('archiveDateText');
  
  if (banner && dateText) {
    dateText.textContent = formatHebrewDate(dateString);
    banner.style.display = 'flex';
  }
}

// Hide archive banner
function hideArchiveBanner() {
  const banner = document.getElementById('archiveBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

  // Form submission handler
document.getElementById('suggestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const words = [
    document.getElementById("word1").value.trim(),
    document.getElementById("word2").value.trim(),
    document.getElementById("word3").value.trim(),
    document.getElementById("word4").value.trim()
];
const connection = document.getElementById("connection").value.trim();
const difficulty = parseInt(document.getElementById("difficulty").value);

  if (words.includes("") || connection === "" || !difficulty) {
      document.getElementById("status").textContent = "כל השדות חובה!";
      return;
  }

    try {
      if (db) {
        await addDoc(collection(db, "suggested_ideas"), {
          words: words,
          connection: connection,
          difficulty: difficulty,  // Now stored as number 1-4
          timestamp: new Date()
        });
        console.log("Suggestion submitted successfully to Firebase!");
      } else {
        console.log("Firebase not available - suggestion not saved:", { words, connection, difficulty });
      }
      
      // Close modal
      const modalElement = document.getElementById('formModal');
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
      
      // Show success message
      var successAlert = document.getElementById('successSubmitMessage');
      successAlert.style.display = 'block';
      successAlert.style.opacity = '1';

      setTimeout(function() {
        let fadeEffect = setInterval(function () {
            if (!successAlert.style.opacity) {
                successAlert.style.opacity = '1';
            }
            if (successAlert.style.opacity > '0') {
                successAlert.style.opacity -= '0.1';
            } else {
                clearInterval(fadeEffect);
                successAlert.style.display = 'none';
            }
        }, 50);
      }, 3000);
      
    } catch (error) {
      console.error("Error submitting:", error);
      alert("שגיאה בשליחת ההצעה. נסה שוב מאוחר יותר.");
    }
    
    document.getElementById("suggestForm").reset();
});