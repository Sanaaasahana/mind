const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced startup logging
console.log('🚀 Starting MindfulSpace server...');
console.log('Environment:', process.env.NODE_ENV || 'production');
console.log('Port:', PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

// Parse database URL for logging (without exposing password)
let dbConnectionInfo = {};
try {
  const parsedUrl = new URL(process.env.DATABASE_URL);
  dbConnectionInfo = {
    host: parsedUrl.hostname,
    port: parsedUrl.port,
    database: parsedUrl.pathname.slice(1),
    user: parsedUrl.username,
    ssl: true
  };
  console.log('Database Connection Info:', dbConnectionInfo);
} catch (error) {
  console.error('Error parsing DATABASE_URL:', error.message);
}

// Database connection pool with enhanced configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database connection event handlers
pool.on('connect', (client) => {
  console.log('New database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

pool.on('remove', (client) => {
  console.log('Database connection removed');
});

// Test database connection on startup
async function testDatabaseConnection() {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully. Current time:', res.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
}

// Middleware configuration
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`, // Render's hostname
    /\.onrender\.com$/ // Allow any onrender.com subdomain
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, "login")));

// Request logging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Request body:', { ...req.body, password: req.body.password ? '[HIDDEN]' : undefined });
    }
    next();
  });
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "mindful-space-secret-key-change-in-production";

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Database initialization
async function initDatabase() {
  try {
    console.log("🔄 Initializing database tables...");

    // Create tables with IF NOT EXISTS
    const createTablesQueries = [
      `CREATE TABLE IF NOT EXISTS users (
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
      )`,
      // ... [keep all your existing table creation queries]
    ];

    // Execute all table creation queries
    for (const query of createTablesQueries) {
      await pool.query(query);
    }

    console.log("✅ Database tables created successfully");

    // Check existing users
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    console.log(`📊 Current user count: ${userCount.rows[0].count}`);

    // Insert sample data if needed
    if (parseInt(userCount.rows[0].count) === 0 && 
        (process.env.NODE_ENV !== 'production' || process.env.INSERT_SAMPLE_DATA === 'true')) {
      console.log("🔄 No users found, inserting sample data...");
      await insertSampleData();
    }

  } catch (error) {
    console.error("❌ Database initialization error:", error);
    throw error;
  }
}

// Sample data insertion with transaction
async function insertSampleData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const hashedPassword = await bcrypt.hash('password123', 10);

    const result = await client.query(`
      INSERT INTO users (email, password, name, age, gender, bio, profile_complete, join_date) VALUES
      ('sarah@example.com', $1, 'Sarah Johnson', 28, 'female', 'Mental health advocate and yoga enthusiast', true, NOW() - INTERVAL '30 days'),
      ('michael@example.com', $1, 'Michael Chen', 34, 'male', 'Meditation practitioner and wellness coach', true, NOW() - INTERVAL '15 days'),
      ('emma@example.com', $1, 'Emma Rodriguez', 25, 'female', 'Art therapy student learning to heal through creativity', true, NOW() - INTERVAL '7 days')
      RETURNING id, email, name
    `, [hashedPassword]);

    console.log("✅ Sample users inserted:", result.rows);

    if (result.rows.length > 0) {
      await client.query(`
        INSERT INTO journal_entries (user_id, content, category, is_public, created_at) VALUES
        (1, 'Today I practiced gratitude meditation for 20 minutes. It helped me center myself and appreciate the small moments of joy in my day.', 'mindfulness', true, NOW() - INTERVAL '2 days'),
        (2, 'Dealing with work stress has been challenging lately. I''ve been using breathing exercises and they really help.', 'stress', true, NOW() - INTERVAL '1 day'),
        (3, 'Art therapy session today was incredible. I painted my emotions and it felt so liberating.', 'personal-growth', true, NOW())
      `);

      await client.query(`
        INSERT INTO mood_entries (user_id, mood, emoji, date) VALUES
        (1, 'happy', '😊', CURRENT_DATE - INTERVAL '2 days'),
        (1, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
        (2, 'anxious', '😰', CURRENT_DATE - INTERVAL '2 days'),
        (2, 'calm', '😌', CURRENT_DATE - INTERVAL '1 day'),
        (3, 'happy', '😊', CURRENT_DATE - INTERVAL '1 day')
      `);
    }

    await client.query('COMMIT');
    console.log("✅ Sample data inserted successfully");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error inserting sample data:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: "Connected",
    renderExternalHostname: process.env.RENDER_EXTERNAL_HOSTNAME || 'Not set'
  });
});

// Database diagnostics endpoint
app.get("/api/db-info", async (req, res) => {
  try {
    const dbInfo = await pool.query(`
      SELECT current_database(), current_user, inet_server_addr(), inet_server_port()
    `);
    const tableInfo = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    res.json({
      connection: dbInfo.rows[0],
      tables: tableInfo.rows.map(row => row.table_name),
      dbConnectionInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// [Keep all your existing routes exactly as they were]

// Serve frontend files - updated for combined deployment
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Start server with initialization
async function startServer() {
  try {
    await testDatabaseConnection();
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Access at: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
