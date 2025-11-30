// Analytics and Statistics Management
export class GameAnalytics {
  constructor() {
    this.storageKey = 'connections_analytics';
    this.init();
  }

  init() {
    const data = this.getData();
    if (!data) {
      this.setData({
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastPlayedDate: null,
        history: {}, // date: { won: boolean, mistakes: number, time: number }
        totalMistakes: 0,
        averageTime: 0,
        perfectGames: 0 // games won with 0 mistakes
      });
    }
  }

  getData() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : null;
  }

  setData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  recordGameStart(date) {
    const data = this.getData();
    data.lastPlayedDate = date;
    this.setData(data);
  }

  recordGameEnd(won, mistakes, timeInSeconds) {
    const data = this.getData();
    const today = new Date().toISOString().split('T')[0];
    
    data.gamesPlayed++;
    
    if (won) {
      data.gamesWon++;
      
      // Update streak
      if (this.isConsecutiveDay(data.lastPlayedDate, today)) {
        data.currentStreak++;
      } else if (data.lastPlayedDate !== today) {
        data.currentStreak = 1;
      }
      
      data.maxStreak = Math.max(data.maxStreak, data.currentStreak);
      
      // Check if perfect game
      if (mistakes === 0) {
        data.perfectGames++;
      }
    } else {
      // Lost the game, reset streak
      data.currentStreak = 0;
    }
    
    // Record history
    data.history[today] = {
      won,
      mistakes,
      time: timeInSeconds,
      timestamp: Date.now()
    };
    
    data.totalMistakes += mistakes;
    data.lastPlayedDate = today;
    
    // Calculate average time
    const completedGames = Object.values(data.history).filter(h => h.won);
    if (completedGames.length > 0) {
      data.averageTime = completedGames.reduce((sum, h) => sum + h.time, 0) / completedGames.length;
    }
    
    this.setData(data);
    return data;
  }

  isConsecutiveDay(lastDate, currentDate) {
    if (!lastDate) return false;
    const last = new Date(lastDate);
    const current = new Date(currentDate);
    const diffTime = current - last;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }

  getStats() {
    const data = this.getData();
    return {
      gamesPlayed: data.gamesPlayed,
      winRate: data.gamesPlayed > 0 ? Math.round((data.gamesWon / data.gamesPlayed) * 100) : 0,
      currentStreak: data.currentStreak,
      maxStreak: data.maxStreak,
      averageMistakes: data.gamesPlayed > 0 ? (data.totalMistakes / data.gamesPlayed).toFixed(1) : 0,
      averageTime: Math.round(data.averageTime),
      perfectGames: data.perfectGames,
      history: data.history
    };
  }

  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const data = this.getData();
    return data.history[today] || null;
  }

  hasPlayedToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.getTodayStats() !== null;
  }

  // Get distribution of results (for visualization)
  getResultsDistribution() {
    const data = this.getData();
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, failed: 0 };
    
    Object.values(data.history).forEach(game => {
      if (game.won) {
        distribution[game.mistakes] = (distribution[game.mistakes] || 0) + 1;
      } else {
        distribution.failed++;
      }
    });
    
    return distribution;
  }

  // Get last N games
  getRecentGames(n = 7) {
    const data = this.getData();
    const games = Object.entries(data.history)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, n)
      .map(([date, game]) => ({ date, ...game }));
    return games;
  }
}

// Export singleton instance
export const analytics = new GameAnalytics();

