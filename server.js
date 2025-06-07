const express = require("express")
const cors = require("cors")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { Pool } = require("pg")
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
app.use(express.static("public"))

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

// Auth middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.userId])

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid token" })
    }

    req.user = result.rows[0]
    next()
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" })
  }
}

// Helper function to generate JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" })
}

// ===== AUTH ROUTES =====

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" })
    }

    // Check if user exists
    const existingUser = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" })
    }

    // Hash password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create user
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, profile_complete",
      [name, email, hashedPassword],
    )

    const user = result.rows[0]
    const token = generateToken(user.id)

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileComplete: user.profile_complete,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const user = result.rows[0]

    // Check password
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = generateToken(user.id)

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
        gender: user.gender,
        bio: user.bio,
        profileComplete: user.profile_complete,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ===== USER ROUTES =====

// Get current user profile
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, age, gender, bio, profile_complete, created_at FROM users WHERE id = $1",
      [req.user.id],
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Update user profile
app.put("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const { name, age, gender, bio } = req.body

    const result = await pool.query(
      "UPDATE users SET name = $1, age = $2, gender = $3, bio = $4, profile_complete = true, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, name, email, age, gender, bio, profile_complete",
      [name, age, gender, bio, req.user.id],
    )

    res.json({
      message: "Profile updated successfully",
      user: result.rows[0],
    })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get all users (for connect page)
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, age, gender, bio, created_at FROM users WHERE id != $1 AND profile_complete = true ORDER BY created_at DESC",
      [req.user.id],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ===== JOURNAL ROUTES =====

// Get user's journal entries
app.get("/api/journal", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM journal_entries WHERE user_id = $1 ORDER BY created_at DESC", [
      req.user.id,
    ])

    res.json(result.rows)
  } catch (error) {
    console.error("Get journal entries error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Create journal entry
app.post("/api/journal", authenticateToken, async (req, res) => {
  try {
    const { content, category, isPublic } = req.body

    if (!content) {
      return res.status(400).json({ error: "Content is required" })
    }

    const result = await pool.query(
      "INSERT INTO journal_entries (user_id, content, category, is_public) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, content, category, isPublic || false],
    )

    res.status(201).json({
      message: "Journal entry created successfully",
      entry: result.rows[0],
    })
  } catch (error) {
    console.error("Create journal entry error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Delete journal entry
app.delete("/api/journal/:id", authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id

    const result = await pool.query("DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING *", [
      entryId,
      req.user.id,
    ])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Journal entry not found" })
    }

    res.json({ message: "Journal entry deleted successfully" })
  } catch (error) {
    console.error("Delete journal entry error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get public journal entries (for support group)
app.get("/api/journal/public", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT je.*, u.name as user_name 
      FROM journal_entries je 
      JOIN users u ON je.user_id = u.id 
      WHERE je.is_public = true 
      ORDER BY je.created_at DESC
    `)

    res.json(result.rows)
  } catch (error) {
    console.error("Get public journal entries error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ===== MOOD ROUTES =====

// Get user's mood entries
app.get("/api/mood", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM mood_entries WHERE user_id = $1 ORDER BY date DESC", [req.user.id])

    res.json(result.rows)
  } catch (error) {
    console.error("Get mood entries error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Set mood for today
app.post("/api/mood", authenticateToken, async (req, res) => {
  try {
    const { mood, emoji } = req.body
    const today = new Date().toISOString().split("T")[0]

    if (!mood || !emoji) {
      return res.status(400).json({ error: "Mood and emoji are required" })
    }

    const result = await pool.query(
      `
      INSERT INTO mood_entries (user_id, mood, emoji, date) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (user_id, date) 
      DO UPDATE SET mood = $2, emoji = $3, created_at = CURRENT_TIMESTAMP 
      RETURNING *
    `,
      [req.user.id, mood, emoji, today],
    )

    res.json({
      message: "Mood updated successfully",
      mood: result.rows[0],
    })
  } catch (error) {
    console.error("Set mood error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ===== GRATITUDE ROUTES =====

// Get user's gratitude entries for today
app.get("/api/gratitude", authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]
    const result = await pool.query(
      "SELECT * FROM gratitude_entries WHERE user_id = $1 AND date = $2 ORDER BY created_at DESC",
      [req.user.id, today],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get gratitude entries error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Add gratitude entry
app.post("/api/gratitude", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body
    const today = new Date().toISOString().split("T")[0]

    if (!content) {
      return res.status(400).json({ error: "Content is required" })
    }

    const result = await pool.query(
      "INSERT INTO gratitude_entries (user_id, content, date) VALUES ($1, $2, $3) RETURNING *",
      [req.user.id, content, today],
    )

    res.status(201).json({
      message: "Gratitude entry added successfully",
      entry: result.rows[0],
    })
  } catch (error) {
    console.error("Add gratitude entry error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ===== FRIEND ROUTES =====

// Send friend request
app.post("/api/friends/request", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" })
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" })
    }

    // Check if request already exists
    const existingRequest = await pool.query(
      "SELECT * FROM friend_requests WHERE requester_id = $1 AND requested_id = $2",
      [req.user.id, userId],
    )

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: "Friend request already sent" })
    }

    const result = await pool.query(
      "INSERT INTO friend_requests (requester_id, requested_id) VALUES ($1, $2) RETURNING *",
      [req.user.id, userId],
    )

    res.status(201).json({
      message: "Friend request sent successfully",
      request: result.rows[0],
    })
  } catch (error) {
    console.error("Send friend request error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get user's friend requests (sent and received)
app.get("/api/friends/requests", authenticateToken, async (req, res) => {
  try {
    const sentRequests = await pool.query(
      `
      SELECT fr.*, u.name as requested_name 
      FROM friend_requests fr 
      JOIN users u ON fr.requested_id = u.id 
      WHERE fr.requester_id = $1
    `,
      [req.user.id],
    )

    const receivedRequests = await pool.query(
      `
      SELECT fr.*, u.name as requester_name 
      FROM friend_requests fr 
      JOIN users u ON fr.requester_id = u.id 
      WHERE fr.requested_id = $1 AND fr.status = 'pending'
    `,
      [req.user.id],
    )

    res.json({
      sent: sentRequests.rows,
      received: receivedRequests.rows,
    })
  } catch (error) {
    console.error("Get friend requests error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Accept/reject friend request
app.put("/api/friends/request/:id", authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id
    const { status } = req.body // 'accepted' or 'rejected'

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    const result = await pool.query(
      "UPDATE friend_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND requested_id = $3 RETURNING *",
      [status, requestId, req.user.id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Friend request not found" })
    }

    res.json({
      message: `Friend request ${status} successfully`,
      request: result.rows[0],
    })
  } catch (error) {
    console.error("Update friend request error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Get user's friends (accepted connections)
app.get("/api/friends", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT DISTINCT u.id, u.name, u.age, u.gender, u.bio, u.created_at
      FROM users u
      JOIN friend_requests fr ON (
        (fr.requester_id = u.id AND fr.requested_id = $1) OR
        (fr.requested_id = u.id AND fr.requester_id = $1)
      )
      WHERE fr.status = 'accepted' AND u.id != $1
    `,
      [req.user.id],
    )

    res.json(result.rows)
  } catch (error) {
    console.error("Get friends error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ===== STATS ROUTES =====

// Get user statistics
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    // Get total users count
    const totalUsersResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE profile_complete = true")

    // Get user's friend requests count
    const friendRequestsResult = await pool.query(
      "SELECT COUNT(*) as count FROM friend_requests WHERE requester_id = $1",
      [req.user.id],
    )

    // Get user's connections count
    const connectionsResult = await pool.query(
      `
      SELECT COUNT(*) as count FROM friend_requests 
      WHERE (requester_id = $1 OR requested_id = $1) AND status = 'accepted'
    `,
      [req.user.id],
    )

    // Get user's journal entries count
    const journalEntriesResult = await pool.query("SELECT COUNT(*) as count FROM journal_entries WHERE user_id = $1", [
      req.user.id,
    ])

    res.json({
      totalUsers: Number.parseInt(totalUsersResult.rows[0].count) - 1, // Exclude current user
      friendRequests: Number.parseInt(friendRequestsResult.rows[0].count),
      connections: Number.parseInt(connectionsResult.rows[0].count),
      journalEntries: Number.parseInt(journalEntriesResult.rows[0].count),
    })
  } catch (error) {
    console.error("Get stats error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error)
  res.status(500).json({ error: "Internal server error" })
})

// Start server
app.listen(PORT, () => {
  console.log(`MindfulSpace server running on port ${PORT}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  pool.end(() => {
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully")
  pool.end(() => {
    process.exit(0)
  })
})
