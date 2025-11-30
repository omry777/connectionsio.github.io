import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { analytics } from './analytics.js';
import { puzzleGenerator } from './puzzleGenerator.js';

let puzzle = {};
let selectedItems = [];
let currentGroups = [];
let mistakesCount = 0;
let gameStartTime = null;
let gameActive = false;
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
  
  // Record game result
  const stats = analytics.recordGameEnd(won, mistakesCount, timeElapsed);
  
  // Update global statistics in Firebase
  updateGlobalStats(won, mistakesCount);
  
  if (won) {
    showVictoryModal(stats, timeElapsed);
  } else {
    // Show the "Better luck next time" message
    setTimeout(() => {
      alert('הפעם זה לא הלך, בהצלחה ביום הבא');
      revealSolutions();
      showStatsModal();
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

// Load puzzle based on today's date
async function loadTodaysPuzzle() {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // First try to load from JSON
    const response = await fetch('puzzles.json');
    const data = await response.json();
    puzzle = data.puzzles.find(p => p.date === today);
    
    // If no puzzle for today, generate one
    if (!puzzle) {
      console.log('No puzzle found for today, generating new one...');
      puzzle = puzzleGenerator.generatePuzzle(today);
    }
    
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
    } else {
      alert('No puzzle found for today.');
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
    alert('זו לא הקבוצה עליה חשבנו, נסה שוב!');
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

// Show victory modal
function showVictoryModal(stats, timeElapsed) {
  const modal = document.getElementById('victoryModal') || createVictoryModal();
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = timeElapsed % 60;
  
  modal.querySelector('.victory-content').innerHTML = `
    <h2 class="hebrew-text">🎉 כל הכבוד! 🎉</h2>
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
      <button class="btn btn-primary" onclick="shareResults()">שתף תוצאות</button>
      <button class="btn btn-secondary" onclick="showStatsModal()">סטטיסטיקות</button>
    </div>
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
function updateStatsModalContent() {
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
      <h3>סטטיסטיקות גלובליות - היום</h3>
      <div id="globalStatsContent">טוען...</div>
    </div>
  `;
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

// Update global statistics in Firebase
async function updateGlobalStats(won, mistakes) {
  if (!db) {
    console.log('Firebase not configured - skipping global stats update');
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, 'dailyStats', today);
    
    await setDoc(statsRef, {
      totalPlays: increment(1),
      totalWins: increment(won ? 1 : 0),
      totalMistakes: increment(mistakes),
      lastUpdated: new Date()
    }, { merge: true });
    console.log('Global stats updated successfully');
  } catch (error) {
    console.log('Could not update global stats:', error);
  }
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
      const globalStatsContent = document.getElementById('globalStatsContent');
      if (globalStatsContent) {
        globalStatsContent.innerHTML = `
          <div class="global-stat">
            <span>סך משחקים:</span> <strong>${data.totalPlays || 0}</strong>
          </div>
          <div class="global-stat">
            <span>אחוז הצלחה:</span> <strong>${data.totalPlays > 0 ? Math.round((data.totalWins / data.totalPlays) * 100) : 0}%</strong>
          </div>
          <div class="global-stat">
            <span>ממוצע טעויות:</span> <strong>${data.totalPlays > 0 ? (data.totalMistakes / data.totalPlays).toFixed(1) : 0}</strong>
          </div>
        `;
      }
    }
  } catch (error) {
    console.log('Could not load global stats:', error);
  }
}

// Initialize Firebase
let app, db;
try {
  // Access firebaseConfig from window object (loaded via script tag)
  const config = window.firebaseConfig;
  if (config && config.apiKey && config.apiKey !== 'YOUR_API_KEY') {
    app = initializeApp(config);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
  } else {
    console.log('Firebase not configured - using local features only');
  }
} catch (error) {
  console.log('Firebase initialization failed - using local features only:', error);
}
// const database = firebase.database();

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