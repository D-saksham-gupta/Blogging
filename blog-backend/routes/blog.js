const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  getMyBlogs,
  updateBlog,
  deleteBlog,
  toggleLike,
  getBlogStats,
  getTrendingBlogs,
  getRelatedBlogs,
} = require("../controllers/blogController");
const { protect, optionalAuth } = require("../middleware/auth");

// Validation rules
const blogValidation = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Title must be between 5 and 200 characters"),
  body("content")
    .trim()
    .isLength({ min: 50 })
    .withMessage("Content must be at least 50 characters"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn([
      "Technology",
      "Lifestyle",
      "Travel",
      "Food",
      "Health",
      "Business",
      "Entertainment",
      "Education",
      "Sports",
      "Other",
    ])
    .withMessage("Invalid category"),
];

// Public routes
router.get("/", getAllBlogs);
router.get("/trending", getTrendingBlogs);
router.get("/:slug", optionalAuth, getBlogBySlug);
router.get("/:id/stats", getBlogStats);
router.get("/:id/related", getRelatedBlogs);

// Private routes
router.post("/", protect, blogValidation, createBlog);
router.get("/user/my-blogs", protect, getMyBlogs);
router.put("/:id", protect, updateBlog);
router.delete("/:id", protect, deleteBlog);
router.post("/:id/like", protect, toggleLike);

module.exports = router;
