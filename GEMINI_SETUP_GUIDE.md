# 🌟 Gemini AI Puzzle Generator Setup Guide

## 🎉 Why Gemini?

- ✅ **100% FREE** - No credit card needed!
- ✅ **60 requests/minute** - More than enough
- ✅ **Great Hebrew support** - Native multilingual
- ✅ **Fast & reliable** - Google's infrastructure
- ✅ **Easy setup** - Just one API key

---

## 🚀 Quick Start (5 Steps)

### Step 1: Get Your FREE API Key

1. Go to: **https://makersuite.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Click **"Create API key in new project"** (or select existing)
5. **Copy the key** (starts with `AIza...`)

**That's it!** No billing setup needed! 🎉

---

### Step 2: Install Dependencies

```bash
cd /Users/omry.ben-david/Documents/connectionsio/connectionsio.github.io
npm install
```

This installs:
- `@google/generative-ai` - Official Gemini library
- `dotenv` - Environment variable management

---

### Step 3: Configure Your API Key

1. **Copy the example file:**
```bash
cp env.example .env
```

2. **Edit `.env` and add your key:**
```bash
# Open in any text editor
nano .env
# or
code .env
```

Add this:
```bash
GEMINI_API_KEY=AIzaSyD...your-actual-key-here...
GEMINI_MODEL=gemini-2.5-pro
```

3. **Save and close**

---

### Step 4: Test It!

**Preview a puzzle (doesn't save):**
```bash
npm run preview-gemini
```

You should see:
```
🎮 Connections - Gemini AI Puzzle Generator
🤖 Using model: gemini-pro
🎯 Mode: Preview

📅 Generating puzzles for: 2025-11-27

🤖 Generating puzzle for 2025-11-27 using Gemini gemini-pro...

============================================================
📅 Puzzle for: 2025-11-27
============================================================

⭐ Group 1: מילים שמסתיימות ב"ה"
   שמחה, תודה, ברכה, אהבה

⭐⭐ Group 2: פירות הדר
   תפוז, לימון, אשכולית, קלמנטינה

...
```

---

### Step 5: Generate Real Puzzles!

```bash
# Generate tomorrow's puzzle
npm run generate-gemini

# Generate next 7 days
npm run generate-gemini-week

# Generate for specific date
node generate-puzzle-gemini.js --date 2025-12-25
```

---

## 📋 Available Commands

### Basic Commands
```bash
npm run preview-gemini          # Preview without saving
npm run generate-gemini         # Generate tomorrow
npm run generate-gemini-week    # Generate next 7 days
npm run stats                   # View statistics
```

### Advanced Commands
```bash
# Generate specific date
node generate-puzzle-gemini.js --date 2025-12-25

# Generate 30 days
node generate-puzzle-gemini.js --days 30

# Force save (override duplicates)
node generate-puzzle-gemini.js --force

# Allow word reuse
node generate-puzzle-gemini.js --allow-reuse

# Custom retry attempts (default: 3)
node generate-puzzle-gemini.js --retry 5
```

---

## 🎯 How It Works

### 1. **Smart Prompt Engineering**
The script sends a detailed Hebrew prompt to Gemini:
- Requests 4 groups of 4 words
- Specifies difficulty levels (1-4)
- Asks for creative connections
- Ensures no duplicates

### 2. **Automatic Validation**
Every generated puzzle is checked:
- ✅ Structure (16 words, 4 groups)
- ✅ No duplicate words
- ✅ All words accounted for
- ✅ Compared against existing puzzles

### 3. **Retry Logic**
If validation fails, it automatically:
- Regenerates the puzzle
- Tries up to 3 times (configurable)
- Shows clear error messages

### 4. **Duplicate Prevention**
Compares new puzzles against your entire database:
- Checks every word
- Shows which puzzles used those words
- Blocks saving if duplicates found

---

## 💰 Pricing & Limits

### Free Tier (What You Get)
- **60 requests per minute** 
- **15 requests per 60 seconds** (rate limit)
- **1,500 requests per day**
- **$0 cost** forever!

### What This Means
- Generate **1,500 puzzles per day** for FREE
- That's **4+ years of daily puzzles** in one day
- You'll never hit the limit! 🎉

---

## 🔍 Example Output

```bash
$ npm run generate-gemini

🎮 Connections - Gemini AI Puzzle Generator
🤖 Using model: gemini-pro
🎯 Mode: Generate & Save
🔍 Duplicate Check: Enabled

📅 Generating puzzles for: 2025-11-27

🤖 Generating puzzle for 2025-11-27 using Gemini gemini-pro...

============================================================
📅 Puzzle for: 2025-11-27
============================================================

⭐ Group 1: כלי מטבח
   סכין, מזלג, כפית, צלחת

⭐⭐ Group 2: מקצועות בבריאות
   רופא, אחות, פרמדיק, רוקח

⭐⭐⭐ Group 3: מילים שמתחילות ב"מ"
   מים, מלח, מתוק, מר

⭐⭐⭐⭐ Group 4: ביטויים עם "לב"
   לב שבור, לב טוב, לב אריה, לב ים

============================================================

🔍 UNIQUENESS CHECK
============================================================

✅ INFO:
   ✅ No duplicate words found
   ✅ All explanations are unique

============================================================
✅ VALIDATION PASSED
============================================================

✅ Added new puzzle for 2025-11-27
💾 Saved to puzzles.json

✅ Success!

🎉 Done!
```

---

## 🛠️ Troubleshooting

### Error: "Gemini API key not configured"

**Fix:**
```bash
# Make sure .env file exists
ls -la .env

# If not, copy from example
cp env.example .env

# Edit and add your key
nano .env
```

### Error: "Cannot find module '@google/generative-ai'"

**Fix:**
```bash
npm install
```

### Error: "API key not valid"

**Fix:**
1. Check your key starts with `AIza`
2. No extra spaces in `.env` file
3. Generate new key: https://makersuite.google.com/app/apikey

### Error: "Rate limit exceeded"

**Fix:**
- Wait 60 seconds
- Free tier: 60 requests/minute
- This is very generous - unlikely to hit it

### Puzzle quality isn't great

**Tips:**
1. Use `--retry 5` for more attempts
2. Generate multiple and pick best
3. Edit manually after generation
4. The prompt is in the code - customize it!

---

## 🎨 Customizing the Prompt

Want different style puzzles? Edit `generate-puzzle-gemini.js` around line 53:

```javascript
const prompt = `
אתה מומחה במשחק Connections בעברית...
// ADD YOUR CUSTOM INSTRUCTIONS HERE
התמקד בנושא ___
השתמש במילים מהתחום ___
`;
```

Ideas:
- Focus on specific themes (sports, food, etc.)
- Change difficulty balance
- Prefer wordplay vs. factual connections
- Seasonal themes (holidays, etc.)

---

## 📊 Quality Comparison

| Feature | Local Generator | Gemini AI | OpenAI GPT-4 |
|---------|----------------|-----------|--------------|
| **Cost** | FREE | **FREE** | $0.01/puzzle |
| **Quality** | Good | **Excellent** | Excellent |
| **Variety** | Limited (20) | **Unlimited** | Unlimited |
| **Speed** | Instant | 3-5 sec | 5-10 sec |
| **Hebrew** | Perfect | **Great** | Great |
| **Setup** | None | Easy | Medium |

**Winner: Gemini! 🏆** Free + Excellent + Easy!

---

## 🔒 Security Checklist

✅ `.env` file is in `.gitignore`  
✅ Never commit `.env` to Git  
✅ Never share your API key  
✅ API key starts with `AIza`  
✅ Use environment variables only  

---

## 🎯 Recommended Workflow

### Weekly Generation
Every Sunday, generate next week:
```bash
npm run generate-gemini-week
```

Review all puzzles, test in game, commit the good ones.

### Monthly Batch
Generate a month worth:
```bash
node generate-puzzle-gemini.js --days 30
```

Review and curate the best ones.

### Quality Control
1. Generate 2-3 puzzles per date
2. Preview each with `--preview`
3. Pick the best one
4. Save with specific date

---

## 🎉 You're All Set!

**Quick Start:**
```bash
npm run preview-gemini
```

If you see a puzzle, you're ready! 🚀

**Generate your first puzzle:**
```bash
npm run generate-gemini
```

---

## 📚 Additional Resources

- **Gemini API Docs:** https://ai.google.dev/docs
- **Get API Key:** https://makersuite.google.com/app/apikey
- **Rate Limits:** https://ai.google.dev/docs/rate_limits
- **Models:** https://ai.google.dev/models/gemini

---

## 💡 Pro Tips

1. **Generate in batches** - More efficient
2. **Review before committing** - AI isn't perfect
3. **Mix with manual curation** - Edit after generation
4. **Track stats** - Use `npm run stats` regularly
5. **Backup puzzles.json** - Before big generation runs

---

**Happy Puzzle Generating! 🎮✨**

The best part? **It's completely FREE!** 🎉

