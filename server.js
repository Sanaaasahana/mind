const express = require("express")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { Pool } = require("pg")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

console.log('🚀 Starting MindfulSpace server...')
console.log('Environment:', process.env.NODE_ENV || 'production')
console.log('Port:', PORT)
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET)

// Database connection with better error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon and most cloud databases
  },
  // Connection pool settings for production
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack)
    process.exit(1) // Exit if can't connect to database
  } else {
    console.log('✅ Database connected successfully')
    release()
  }
})

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    process.env.FRONTEND_URL, // Add this to your Render environment variables
    /\.onrender\.com$/ // Allow any onrender.com subdomain
  ].filter(Boolean), // Remove undefined values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.static(path.join(__dirname, "public")))

// Request logging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Request body:', { ...req.body, password: req.body.password ? '[HIDDEN]' : undefined })
    }
    next()
  })
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "mindful-space-secret-key-change-in-production"

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" })
    }
    req.user = user
    next()
  })
}

// Initialize database tables
async function initDatabase() {
  try {
    console.log("🔄 Initializing database tables...")

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          age INTEGER,
          gender VARCHAR(50),
          bio TEXT,
          profile_complete BOOLEAN DEFAULT FALSE,
          join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Journal entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          category VARCHAR(100),
          is_public BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Mood tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mood_entries (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          mood VARCHAR(50) NOT NULL,
          emoji VARCHAR(10) NOT NULL,
          date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, date)
      )
    `)

    // Gratitude entries table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gratitude_entries (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Friend connections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
          id SERIAL PRIMARY KEY,
          requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          requested_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(requester_id, requested_id)
      )
    `)

    // User achievements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          achievement_type VARCHAR(100) NOT NULL,
          unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, achievement_type)
      )
    `)

    // Support interactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_interactions (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
          interaction_type VARCHAR(50) DEFAULT 'support',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_public ON journal_entries(is_public)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON mood_entries(user_id, date)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gratitude_entries_user_date ON gratitude_entries(user_id, date)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_friend_requests_requested ON friend_requests(requested_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_interactions_sender ON support_interactions(sender_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_interactions_receiver ON support_interactions(receiver_id)`)

    console.log("✅ Database tables created successfully")

    // Check existing users
    const userCount = await pool.query("SELECT COUNT(*) FROM users")
    console.log(`📊 Current user count: ${userCount.rows[0].count}`)

    // Only insert sample data in development or if explicitly requested
    if (parseInt(userCount.rows[0].count) === 0 && (process.env.NODE_ENV !== 'production' || process.env.INSERT_SAMPLE_DATA === 'true')) {
      console.log("🔄 No users found, inserting sample data...")
      await insertSampleData()
    }

  } catch (error) {
    console.error("❌ Database initialization error:", error)
    throw error // Re-throw to prevent server from starting with broken DB
  }
}

async function insertSampleData() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 10)

    const result = await pool.query(`
      INSERT INTO users (email, password, name, age, gender, bio, profile_complete, join_date) VALUES
      ('sarah@example.com', $1, 'Sarah Johnson', 28, 'female', 'Mental health advocate and yoga enthusiast', true, NOW() - INTERVAL '30 days'),
      ('michael@example.com', $1, 'Michael Chen', 34, 'male', 'Meditation practitioner and wellness coach', true, NOW() - INTERVAL '15 days'),
      ('emma@example.com', $1, 'Emma Rodriguez', 25, 'female', 'Art therapy student learning to heal through creativity', true, NOW() - INTERVAL '7 days')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, name
    `, [hashedPassword])

    console.log("✅ Sample users inserted:", result.rows)

    // Insert sample journal entries if users were created
    if (result.rows.length > 0) {
      await pool.query(`
        INSERT INTO journal_entries (user_id, content, category, is_public, created_at) VALUES
        (1, 'Today I practiced gratitude meditation for 20 minutes. It helped me center myself and appreciate the small moments of joy in my day.', 'mindfulness', true, NOW() - INTERVAL '2 days'),
        (2, 'Dealing with work stress has been challenging lately. I''ve been using breathing exercises and they really help.', 'stress', true, NOW() - INTERVAL '1 day'),
        (3, 'Art therapy session today was incredible. I painted my emotions and it felt so liberating.', 'personal-growth', true, NOW())
        ON CONFLICT DO NOTHING
      `)

      // Insert sample mood entries
      await pool.query(`
        INSERT INTO mood_entries (user_id, mood, emoji, date) VALUES
        (1, 'happy', '😊', CURRENT_DATE - INTERVAL '2 days'),
        (1, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
        (2, 'anxious', '😰', CURRENT_DATE - INTERVAL '2 days'),
        (2, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
        (3, 'happy', '😊', CURRENT_DATE - INTERVAL '1 day')
        ON CONFLICT (user_id, date) DO NOTHING
      `)

      console.log("✅ Sample data inserted successfully")
    }
  } catch (error) {
    console.error("❌ Error inserting sample data:", error)
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: "Connected"
  })
})

// Database test endpoint (disable in production for security)
if (process.env.NODE_ENV !== 'production') {
  app.get("/api/test-db", async (req, res) => {
    try {
      const result = await pool.query('SELECT NOW() as current_time')
      const userCount = await pool.query('SELECT COUNT(*) FROM users')
      const users = await pool.query('SELECT id, email, name FROM users LIMIT 5')
      
      res.json({
        status: 'Database connection successful',
        currentTime: result.rows[0].current_time,
        userCount: userCount.rows[0].count,
        sampleUsers: users.rows
      })
    } catch (error) {
      console.error('Database test error:', error)
      res.status(500).json({ 
        error: 'Database connection failed', 
        details: error.message 
      })
    }
  })
}

// Auth Routes
app.post("/api/register", async (req, res) => {
  try {
    console.log("🔄 Registration attempt for:", req.body.email)

    const { email, password, name } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" })
    }

    // Check if user exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists with this email" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password, name, join_date) VALUES ($1, $2, $3, NOW()) RETURNING id, email, name, profile_complete, join_date",
      [email, hashedPassword, name || '']
    )

    const user = result.rows[0]
    console.log("✅ User created successfully:", { id: user.id, email: user.email })

    // Generate token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" })

    res.status(201).json({
      message: "User created successfully",
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        profileComplete: user.profile_complete,
        joinDate: user.join_date
      },
    })
  } catch (error) {
    console.error("❌ Registration error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/login", async (req, res) => {
  try {
    console.log("🔄 Login attempt for:", req.body.email)

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const user = result.rows[0]
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    console.log("✅ Login successful for:", user.email)

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" })

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        gender: user.gender,
        bio: user.bio,
        profileComplete: user.profile_complete,
        joinDate: user.join_date,
      },
    })
  } catch (error) {
    console.error("❌ Login error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/logout", (req, res) => {
  res.json({ message: "Logout successful" })
})

// Profile Routes
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, name, age, gender, bio, profile_complete, join_date FROM users WHERE id = $1",
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Profile fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const { name, age, gender, bio } = req.body

    if (!name || !age || !gender) {
      return res.status(400).json({ error: "Name, age, and gender are required" })
    }

    const result = await pool.query(
      `UPDATE users 
       SET name = $1, age = $2, gender = $3, bio = $4, profile_complete = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 
       RETURNING id, email, name, age, gender, bio, profile_complete, join_date`,
      [name, age, gender, bio || '', req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Profile update error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Journal Routes
app.post("/api/journal", authenticateToken, async (req, res) => {
  try {
    const { content, category, isPublic } = req.body

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: "Journal content is required" })
    }

    const result = await pool.query(
      "INSERT INTO journal_entries (user_id, content, category, is_public) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.userId, content.trim(), category || null, isPublic || false]
    )

    // Get user name for the response
    const userResult = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.userId])
    const entry = result.rows[0]
    entry.user_name = userResult.rows[0].name

    res.status(201).json(entry)
  } catch (error) {
    console.error("Journal creation error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/journal", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT je.*, u.name as user_name 
       FROM journal_entries je 
       JOIN users u ON je.user_id = u.id 
       WHERE je.user_id = $1 
       ORDER BY je.created_at DESC`,
      [req.user.userId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Journal fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/journal/public", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT je.*, u.name as user_name 
       FROM journal_entries je 
       JOIN users u ON je.user_id = u.id 
       WHERE je.is_public = true 
       ORDER BY je.created_at DESC 
       LIMIT 50`
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Public journal fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.delete("/api/journal/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      "DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Journal entry not found" })
    }

    res.json({ message: "Journal entry deleted successfully" })
  } catch (error) {
    console.error("Journal deletion error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Mood Routes
app.post("/api/mood", authenticateToken, async (req, res) => {
  try {
    const { mood, emoji, date } = req.body

    if (!mood || !emoji || !date) {
      return res.status(400).json({ error: "Mood, emoji, and date are required" })
    }

    const result = await pool.query(
      `INSERT INTO mood_entries (user_id, mood, emoji, date) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, date) 
       DO UPDATE SET mood = $2, emoji = $3, created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.userId, mood, emoji, date]
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error("Mood creation error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/mood", authenticateToken, async (req, res) => {
  try {
    const { month, year, date } = req.query
    let query = "SELECT * FROM mood_entries WHERE user_id = $1"
    let params = [req.user.userId]

    if (date) {
      query += " AND date = $2"
      params.push(date)
    } else if (month && year) {
      query += " AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3"
      params.push(month, year)
    }

    query += " ORDER BY date DESC"

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error("Mood fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Gratitude Routes
app.post("/api/gratitude", authenticateToken, async (req, res) => {
  try {
    const { content, date } = req.body

    if (!content || !date) {
      return res.status(400).json({ error: "Content and date are required" })
    }

    const result = await pool.query(
      "INSERT INTO gratitude_entries (user_id, content, date) VALUES ($1, $2, $3) RETURNING *",
      [req.user.userId, content.trim(), date]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error("Gratitude creation error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/gratitude", authenticateToken, async (req, res) => {
  try {
    const { date } = req.query

    let query = "SELECT * FROM gratitude_entries WHERE user_id = $1"
    let params = [req.user.userId]

    if (date) {
      query += " AND date = $2"
      params.push(date)
    }

    query += " ORDER BY created_at DESC"

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error("Gratitude fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Users/Connect Routes
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, age, gender, bio, join_date FROM users WHERE id != $1 AND profile_complete = true ORDER BY join_date DESC",
      [req.user.userId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Users fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Friend Request Routes
app.post("/api/friend-request", authenticateToken, async (req, res) => {
  try {
    const { requestedId } = req.body

    if (!requestedId) {
      return res.status(400).json({ error: "Requested user ID is required" })
    }

    if (requestedId === req.user.userId) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" })
    }

    const result = await pool.query(
      "INSERT INTO friend_requests (requester_id, requested_id) VALUES ($1, $2) RETURNING *",
      [req.user.userId, requestedId]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: "Friend request already sent" })
    }
    console.error("Friend request error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/friend-requests", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT requested_id FROM friend_requests WHERE requester_id = $1 AND status = 'pending'",
      [req.user.userId]
    )

    res.json(result.rows.map(row => row.requested_id))
  } catch (error) {
    console.error("Friend requests fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Support Routes
app.post("/api/support", authenticateToken, async (req, res) => {
  try {
    const { receiverId, journalEntryId } = req.body

    if (!receiverId) {
      return res.status(400).json({ error: "Receiver ID is required" })
    }

    const result = await pool.query(
      "INSERT INTO support_interactions (sender_id, receiver_id, journal_entry_id, interaction_type) VALUES ($1, $2, $3, 'support') RETURNING *",
      [req.user.userId, receiverId, journalEntryId || null]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error("Support interaction error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Statistics Routes
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    // Get journal count
    const journalResult = await pool.query(
      "SELECT COUNT(*) as count FROM journal_entries WHERE user_id = $1",
      [req.user.userId]
    )

    // Get mood count
    const moodResult = await pool.query(
      "SELECT COUNT(*) as count FROM mood_entries WHERE user_id = $1",
      [req.user.userId]
    )

    // Get gratitude count
    const gratitudeResult = await pool.query(
      "SELECT COUNT(*) as count FROM gratitude_entries WHERE user_id = $1",
      [req.user.userId]
    )

    // Get days active
    const userResult = await pool.query(
      "SELECT join_date FROM users WHERE id = $1",
      [req.user.userId]
    )

    const joinDate = new Date(userResult.rows[0].join_date)
    const today = new Date()
    const daysActive = Math.floor((today - joinDate) / (1000 * 60 * 60 * 24)) + 1

    res.json({
      journalCount: parseInt(journalResult.rows[0].count),
      moodCount: parseInt(moodResult.rows[0].count),
      gratitudeCount: parseInt(gratitudeResult.rows[0].count),
      daysActive: daysActive
    })
  } catch (error) {
    console.error("Stats fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Achievements Routes
app.get("/api/achievements", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT achievement_type, unlocked_at FROM user_achievements WHERE user_id = $1",
      [req.user.userId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Achievements fetch error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Serve frontend files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"))
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.stack)
  res.status(500).json({ error: "Something went wrong!" })
})

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" })
})

// Serve frontend for all other routes (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"))
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  pool.end(() => {
    console.log('Database pool closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  pool.end(() => {
    console.log('Database pool closed')
    process.exit(0)
  })
})

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 MindfulSpace server running on port ${PORT}`)
  try {
    await initDatabase()
    console.log("🎉 Server started successfully!")
  } catch (error) {
    console.error("❌ Failed to initialize database:", error)
    process.exit(1)
  }
})

module.exports = app
