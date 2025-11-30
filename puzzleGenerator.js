// AI Puzzle Generator for Hebrew Connections Game
// This module generates daily puzzles using AI

export class PuzzleGenerator {
  constructor() {
    this.hebrewWordCategories = {
      // Example categories - can be expanded
      colors: ['אדום', 'כחול', 'ירוק', 'צהוב', 'כתום', 'סגול', 'ורוד', 'לבן'],
      animals: ['כלב', 'חתול', 'פיל', 'אריה', 'נמר', 'דוב', 'זאב', 'שועל'],
      fruits: ['תפוח', 'בננה', 'תפוז', 'אבטיח', 'אגס', 'אפרסק', 'שזיף', 'ענבים'],
      cities: ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'אילת', 'נצרת', 'טבריה', 'עכו'],
      bodyParts: ['ראש', 'לב', 'כף', 'רגל', 'עין', 'אף', 'אוזן', 'פה'],
      professions: ['רופא', 'מורה', 'טבח', 'שופט', 'חייל', 'טייס', 'זמר', 'שחקן']
    };
  }

  // Generate a puzzle for a specific date
  generatePuzzle(date) {
    // Use date as seed for consistent daily puzzles
    const seed = this.hashCode(date);
    const random = this.seededRandom(seed);
    
    const groups = this.generateGroups(random);
    const allWords = groups.flatMap(g => g.words);
    
    return {
      date,
      words: allWords,
      groups
    };
  }

  // Generate 4 groups with connections
  generateGroups(random) {
    const templates = this.getGroupTemplates();
    const selectedTemplates = this.shuffleArray(templates, random).slice(0, 4);
    
    const colors = ['#f44336', '#4caf50', '#9c27b0', '#2196f3'];
    
    return selectedTemplates.map((template, index) => ({
      words: template.words,
      color: colors[index],
      explanation: template.explanation
    }));
  }

  // Predefined group templates
  getGroupTemplates() {
    return [
      {
        words: ['שריון', 'אוויר', 'חימוש', 'חינוך'],
        explanation: 'חילות בצה״ל'
      },
      {
        words: ['כדור', 'עט', 'משקל', 'ענן'],
        explanation: 'נוצה_'
      },
      {
        words: ['לב', 'מוח', 'אומץ', 'בית'],
        explanation: 'משאלות בארץ עוץ'
      },
      {
        words: ['שמש', 'פלוס', 'כוכבים', 'מגן דוד'],
        explanation: 'נמצא על דגלים'
      },
      {
        words: ['רמזור', 'פסנתר', 'שחמט', 'דומינו'],
        explanation: 'משחקים ומשחקי לוח'
      },
      {
        words: ['זית', 'שקד', 'אגוז', 'בוטן'],
        explanation: 'אגוזים וזרעים'
      },
      {
        words: ['שופר', 'חצוצרה', 'חליל', 'כינור'],
        explanation: 'כלי נגינה'
      },
      {
        words: ['אביב', 'קיץ', 'סתיו', 'חורף'],
        explanation: 'עונות השנה'
      },
      {
        words: ['ראשון', 'שני', 'שלישי', 'רביעי'],
        explanation: 'ימי השבוע'
      },
      {
        words: ['צפון', 'דרום', 'מזרח', 'מערב'],
        explanation: 'כיווני רוח'
      },
      {
        words: ['שחור', 'לבן', 'אדום', 'צהוב'],
        explanation: 'צבעים בסיסיים'
      },
      {
        words: ['מלך', 'מלכה', 'צריח', 'פרש'],
        explanation: 'כלי שחמט'
      },
      {
        words: ['פרה', 'כבש', 'תרנגולת', 'עז'],
        explanation: 'בעלי חיים במשק'
      },
      {
        words: ['לחם', 'חלב', 'ביצים', 'גבינה'],
        explanation: 'מוצרי יסוד'
      },
      {
        words: ['ספר', 'מחברת', 'עט', 'מחק'],
        explanation: 'ציוד לימודי'
      },
      {
        words: ['מכונית', 'אוטובוס', 'רכבת', 'מטוס'],
        explanation: 'כלי תחבורה'
      },
      {
        words: ['שולחן', 'כיסא', 'ארון', 'מיטה'],
        explanation: 'רהיטים'
      },
      {
        words: ['אדום', 'ורוד', 'סגול', 'חום'],
        explanation: 'גוני אדום'
      },
      {
        words: ['פיצה', 'המבורגר', 'שווארמה', 'פלאפל'],
        explanation: 'אוכל רחוב'
      },
      {
        words: ['גיטרה', 'תופים', 'בס', 'מקלדת'],
        explanation: 'כלי נגינה בלהקת רוק'
      },
      {
        words: ['קפה', 'תה', 'מיץ', 'מים'],
        explanation: 'משקאות'
      },
      {
        words: ['כחול', 'ים', 'שמיים', 'ג׳ינס'],
        explanation: 'דברים כחולים'
      },
    ];
  }

  // Hash function for date seed
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Seeded random number generator
  seededRandom(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // Shuffle array with seeded random
  shuffleArray(array, random) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Generate puzzle using OpenAI API (placeholder - requires API key)
  async generateAIPuzzle(date) {
    // This would integrate with OpenAI API or similar
    // For now, return a template-based puzzle
    console.log('AI Generation would happen here with API key');
    return this.generatePuzzle(date);
  }

  // Save generated puzzle to JSON
  async savePuzzleToFile(puzzle) {
    // In a real implementation, this would save to a backend
    console.log('Saving puzzle:', puzzle);
    return puzzle;
  }
}

export const puzzleGenerator = new PuzzleGenerator();

