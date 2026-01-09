const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  toggleCommentLike,
} = require("../controllers/commentController");
const { protect } = require("../middleware/auth");

// Validation
const commentValidation = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment must be between 1 and 1000 characters"),
];

// Routes
router.post("/:blogId", protect, commentValidation, createComment);
router.get("/:blogId", getComments);
router.put("/:commentId", protect, updateComment);
router.delete("/:commentId", protect, deleteComment);
router.post("/:commentId/like", protect, toggleCommentLike);

module.exports = router;
