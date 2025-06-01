const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const path = require("path")
require("dotenv").config()

const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const journalRoutes = require("./routes/journal")
const moodRoutes = require("./routes/mood")
const gratitudeRoutes = require("./routes/gratitude")
const connectRoutes = require("./routes/connect")

const app = express()
const PORT = process.env.PORT || 3000

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "MindfulSpace API",
  })
})

// Serve static files from public directory
app.use(express.static("public"))

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/journal", journalRoutes)
app.use("/api/mood", moodRoutes)
app.use("/api/gratitude", gratitudeRoutes)
app.use("/api/connect", connectRoutes)

// Serve index.html for all non-API routes (SPA support)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next()
  }
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// 404 handler for API routes only
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err)

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation Error",
      details: err.details,
    })
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Invalid token",
    })
  }

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  })
})

app.listen(PORT, () => {
  console.log(`🌱 MindfulSpace API server running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})

module.exports = app
