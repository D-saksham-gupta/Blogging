const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Import models
require("./models/User");
require("./models/Blog");
require("./models/Comment");

// Initialize express app
const app = express();

// Middleware
app.use(
  cors({
    origin: "https://blog-frontend-eta-seven.vercel.app",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/blogs", require("./routes/blog"));
app.use("/api/comments", require("./routes/comment"));
app.use("/api/admin", require("./routes/admin"));

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Blog API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
