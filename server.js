const express = require("express")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { Pool } = require("pg")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public"))) // Serve static files

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
    // Read and execute the database.sql file
    const fs = require('fs')
    const sqlScript = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8')
    await pool.query(sqlScript)
    console.log("Database initialized successfully")
  } catch (error) {
    console.error("Database initialization error:", error)
  }
}

// Auth Routes
app.post("/api/register", async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" })
    }

    // Check if user already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists with this email" })
    }

    // Hash password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, profile_complete",
      [email, hashedPassword, name || '']
    )

    const user = result.rows[0]

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" })

    res.status(201).json({
      message: "User created successfully",
      token,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        profileComplete: user.profile_complete
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const user = result.rows[0]

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    // Generate JWT token
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
    console.error("Login error:", error)
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
    const { month, year } = req.query
    let query = "SELECT * FROM mood_entries WHERE user_id = $1"
    let params = [req.user.userId]

    if (month && year) {
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
    if (error.code === '23505') { // Unique constraint violation
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

    // Get days active (days since joining)
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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: "Something went wrong!" })
})

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" })
})

// Serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"))
})

// Start server
app.listen(PORT, async () => {
  console.log(`MindfulSpace server running on port ${PORT}`)
  await initDatabase()
})

module.exports = app