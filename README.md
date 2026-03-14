# 🏆 Sports Prediction Arena

AI-powered sports prediction platform with live polls, match flyers, and real-time results - built with Next.js, Vercel, Neon DB, and Gemini AI.

## 🚀 Live Demo

**Production:** https://sports-prediction-app-zeta.vercel.app

## ✨ Features

### 🎮 Core Features
- **Mobile Game Aesthetic** - Neon colors (#00ff87, #ff006e, #ffd700), bold typography, smooth animations
- **Live Prediction Polls** - Vote on match outcomes with real-time percentage displays
- **Countdown Timers** - Auto-close voting when match starts
- **AI-Generated Flyers** - Pre and post-match flyers using Gemini 3 Pro
- **Role-Based Dashboards** - Separate admin and player experiences
- **Notification System** - Subscribe to match result alerts
- **Leaderboard & Stats** - Track points, accuracy, and rankings

### 🔐 Authentication System
- Session-based authentication with secure cookies
- Role-based access control (Admin/Player)
- Test accounts provided for easy testing

### 📊 Database Schema
- **matches** - Match details, polls, scores, flyers
- **users** - User accounts with roles and stats
- **notifications** - Email subscription system
- **user_predictions** - Voting history and points
- **sessions** - Secure session management
- **match_flyers** - AI-generated flyer storage

## 👥 Test Accounts

### Admin Account
```
Email: admin@sports.com
Password: admin123
Access: Create matches, generate flyers, manage polls
```

### Player Accounts
```
Player 1 (John Doe)
Email: player1@sports.com
Password: player123
Points: 250 | Accuracy: 53%

Player 2 (Jane Smith) - TOP PLAYER
Email: player2@sports.com
Password: player123
Points: 420 | Accuracy: 64%

Player 3 (Mike Wilson)
Email: player3@sports.com
Password: player123
Points: 180 | Accuracy: 42%
```

## 🛣️ How It Works

### Poll Lifecycle

1. **Admin Creates Match** (`/admin`)
   - Fill form: Team 1, Team 2, Sport, Match Time
   - Match saved with status='upcoming'

2. **Users Vote** (`/` homepage)
   - Countdown timer shows time until match
   - Click team to submit prediction
   - Vote counts update in real-time
   - Voting automatically closes when timer hits 0

3. **Match Goes Live** (Admin clicks "Start Match")
   - Status changes to 'live'
   - No more voting allowed
   - Poll results frozen

4. **Match Ends** (Admin clicks "Finish")
   - Status changes to 'finished'
   - Admin adds final scores
   - Generate result flyer
   - Notify subscribed users

### AI Flyer Generation

**Pre-Match Flyer:**
- Promotional poster with team names, VS text
- Stadium atmosphere, dynamic energy
- Mobile game aesthetic with neon effects

**Post-Match Flyer:**
- Results celebration with scores
- Winner highlight, trophy, confetti
- Statistics and performance metrics

**Tech:** Gemini 3 Pro (Nano Banana) - 2K resolution, 9:16 aspect ratio

## 💻 Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Neon (Serverless Postgres)
- **AI:** Gemini 3 Pro (Image Generation), OpenAI (Content)
- **Deployment:** Vercel
- **Styling:** Custom game theme with neon colors

## 📖 API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/matches` | GET | Fetch all active matches |
| `/api/matches` | POST | Create new match (Admin) |
| `/api/matches/[id]` | PATCH | Update match status/scores |
| `/api/vote` | POST | Submit match prediction |
| `/api/generate-flyer` | POST | Generate AI flyer |
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/me` | GET | Get current user |
| `/api/notifications/subscribe` | POST | Subscribe to match alerts |

## 🎯 Pages

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Homepage with live matches and polls |
| `/login` | Public | Login page with test account buttons |
| `/admin` | Admin | Create matches and manage system |
| `/admin/dashboard` | Admin | Stats, match table, flyer generation |
| `/player/dashboard` | Player | Personal stats, leaderboard, predictions |

## 🚀 Quick Start

### 1. Test the Live App
Visit: https://sports-prediction-app-zeta.vercel.app

### 2. Login as Admin
- Click "Login" button
- Use: admin@sports.com / admin123
- Go to `/admin` to create matches

### 3. Login as Player
- Use any player account
- Vote on matches from homepage
- Check dashboard for stats

### 4. Generate AI Flyers
- Login as admin
- Go to admin dashboard
- Click "Generate Flyer" on any match
- Uses Gemini 3 Pro for AI image generation

## 🔧 Development

```bash
# Clone repository
git clone https://github.com/lasanthawi/sports-prediction-app.git
cd sports-prediction-app

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Add your POSTGRES_URL from Neon

# Run development server
npm run dev
```

## 🎮 Future Enhancements

- [ ] Real-time WebSocket updates for live matches
- [ ] Email notifications using Gmail API
- [ ] Social sharing of predictions
- [ ] Advanced analytics and charts
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Live match score integration
- [ ] Betting odds display
- [ ] Achievement badges

## 📝 Database Management

### Update Match Status
```sql
-- Mark match as live
UPDATE matches SET status = 'live' WHERE id = 1;

-- Mark match as finished with scores
UPDATE matches 
SET status = 'finished', team1_score = 3, team2_score = 1 
WHERE id = 1;
```

### View Stats
```sql
-- Top players
SELECT name, points, predictions_count, correct_predictions 
FROM users 
WHERE role = 'player' 
ORDER BY points DESC;

-- Match votes
SELECT team1, team2, poll_team1_votes, poll_team2_votes,
       (poll_team1_votes + poll_team2_votes) as total_votes
FROM matches
ORDER BY total_votes DESC;
```

## 👤 Contributors

Built by Lasantha Wickramsinghe with Composio AI

## 📜 License

MIT

---

**🎮 Play Now:** https://sports-prediction-app-zeta.vercel.app