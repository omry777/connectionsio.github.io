import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let puzzle = {};
let selectedItems = [];
let currentGroups = [];
let mistakesCount = 0;
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

function endGame() {
  // Show the "Better luck next time" message
  alert('הפעם זה לא הלך, בהצלחה ביום הבא');
  
  // Reveal all solutions (for this example, assuming solutions are stored in an array)
  revealSolutions();
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
fetch('puzzles.json')
  .then(response => response.json())
  .then(data => {
    const today = new Date().toISOString().split('T')[0];
    puzzle = data.puzzles.find(p => p.date === today);
    if (puzzle) {
        puzzle.groups.forEach((group,index) => {
            group.guessed = false; // Set initial guessed status to false
            group.index = index
        });
      shuffleGrid()
    //   loadPuzzle();
    } else {
      alert('No puzzle found for today.');
    }
  })
  .catch(error => console.error('Error loading puzzle:', error));

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
    alert(`נכון מאוד: ${matchedGroup.explanation}`);
    matchedGroup.guessed = true;
    highlightGroup(matchedGroup);
    removeMatchedWords(matchedGroup.words);
    // removeMatchedGroup(group)
    renderGroups(matchedGroup);
  } else {
    alert('זו לא הקבוצה עליה חשבנו, נסה שוב!');
    deselectAll();
    markMistake()
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
function shuffleGrid() {
    puzzle.words.sort(() => Math.random() - 0.5);
    loadPuzzle();
  }
window.reopenForm = function() {
    document.getElementById("suggestForm").classList.remove("hidden");
    document.getElementById("successSubmitMessage").classList.remove("show");
};

  // Deselect all items
  function deselectAll() {
    selectedItems = [];
    document.querySelectorAll('.grid-item').forEach(item => {
      item.classList.remove('selected');
    });
  }

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
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
const difficulty = document.getElementById("difficulty").value.trim();

  if (words.includes("") || connection === "") {
      document.getElementById("status").textContent = "All fields are required!";
      return;
  }

    try {
      await addDoc(collection(db, "suggested_ideas"), {
        words: words,
        connection: connection,
        difficulty: difficulty,
        timestamp: new Date()
      });
      console.log("Suggestion submitted successfully!");
      document.getElementById("formModal").style.display = 'none';
      // document.getElementById('successSubmitMessage').style.display = 'block';
      var successAlert = document.getElementById('successSubmitMessage');
      successAlert.style.display = 'block';

      setTimeout(function() {
        successAlert.style.opacity = '1';
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
      var modal = bootstrap.Modal.getInstance(document.getElementById('formModal'));
      modal.hide();
    } catch (error) {
      console.error("Error submitting:", error);
    }
    document.getElementById("suggestForm").reset();
});