let puzzle = {};
let selectedItems = [];
let currentGroups = [];

// Load puzzle based on today's date
fetch('puzzles.json')
  .then(response => response.json())
  .then(data => {
    const today = new Date().toISOString().split('T')[0];
    puzzle = data.puzzles.find(p => p.date === today);
    if (puzzle) {
      loadPuzzle();
      shuffleGrid()
    } else {
      alert('No puzzle found for today.');
    }
  })
  .catch(error => console.error('Error loading puzzle:', error));

// Load puzzle words into grid
function loadPuzzle() {
  const grid = document.getElementById('grid');
  grid.innerHTML = ''; // Clear grid
  puzzle.words.forEach(word => {
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
    alert(`Correct! ${matchedGroup.explanation}`);
    highlightGroup(matchedGroup);
    removeMatchedWords(matchedGroup.words);
    renderGroups(matchedGroup);
  } else {
    alert('Incorrect group. Try again!');
    deselectAll();
    
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

// Render matched groups on the left
function renderGroups(group) {
  const groupsContainer = document.getElementById('groups');
  console.log(groupsContainer);
  const groupElement = document.createElement('div');
  groupElement.classList.add('group');
  groupElement.style.borderColor = group.color;
  groupElement.innerHTML = `
    <p><strong>Group Explanation:</strong> ${group.explanation}</p>
    <div class="group-words">${group.words.join(', ')}</div>
  `;
  groupsContainer.appendChild(groupElement);
}

// Shuffle grid
function shuffleGrid() {
    puzzle.words.sort(() => Math.random() - 0.5);
    loadPuzzle();
  }
  
  // Deselect all items
  function deselectAll() {
    selectedItems = [];
    document.querySelectorAll('.grid-item').forEach(item => {
      item.classList.remove('selected');
    });
  }