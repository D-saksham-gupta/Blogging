const express = require("express");
const router = express.Router();
const {
  getPendingBlogs,
  getAllBlogsAdmin,
  approveBlog,
  rejectBlog,
  deleteBlogAdmin,
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  updateUserRole,
  deleteUser,
  getAllComments,
  deleteCommentAdmin,
} = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/admin");

// All routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Dashboard stats
router.get("/stats", getDashboardStats);

// Blog management
router.get("/blogs", getAllBlogsAdmin);
router.get("/blogs/pending", getPendingBlogs);
router.put("/blogs/:id/approve", approveBlog);
router.put("/blogs/:id/reject", rejectBlog);
router.delete("/blogs/:id", deleteBlogAdmin);

// User management
router.get("/users", getAllUsers);
router.put("/users/:id/toggle-status", toggleUserStatus);
router.put("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

// Comment moderation
router.get("/comments", getAllComments);
router.delete("/comments/:id", deleteCommentAdmin);

module.exports = router;
