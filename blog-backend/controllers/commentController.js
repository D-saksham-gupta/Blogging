const Comment = require("../models/Comment");
const Blog = require("../models/Blog");
const { validationResult } = require("express-validator");

// @desc    Create a comment
// @route   POST /api/comments/:blogId
// @access  Private
exports.createComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { blogId } = req.params;
    const { content, parentComment } = req.body;

    // Check if blog exists and is published
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (blog.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "Cannot comment on unpublished blog",
      });
    }

    // If it's a reply, check if parent comment exists
    if (parentComment) {
      const parentCommentDoc = await Comment.findById(parentComment);
      if (!parentCommentDoc) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
      }
    }

    // Create comment
    const comment = await Comment.create({
      blog: blogId,
      user: req.user._id,
      content,
      parentComment: parentComment || null,
    });

    // If it's a reply, add to parent's replies array
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentComment, {
        $push: { replies: comment._id },
      });
    }

    // Update blog's comment count
    blog.commentsCount += 1;
    await blog.save();

    // Populate user details
    await comment.populate("user", "username fullName profileImage");

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating comment",
      error: error.message,
    });
  }
};

// @desc    Get comments for a blog
// @route   GET /api/comments/:blogId
// @access  Public
exports.getComments = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { page = 1, limit = 20, sort = "-createdAt" } = req.query;

    // Check if blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get only top-level comments (no parent)
    const comments = await Comment.find({
      blog: blogId,
      parentComment: null,
      isDeleted: false,
    })
      .populate("user", "username fullName profileImage")
      .populate({
        path: "replies",
        match: { isDeleted: false },
        populate: { path: "user", select: "username fullName profileImage" },
      })
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Comment.countDocuments({
      blog: blogId,
      parentComment: null,
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching comments",
      error: error.message,
    });
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:commentId
// @access  Private (Comment author only)
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the comment author
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this comment",
      });
    }

    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    await comment.populate("user", "username fullName profileImage");

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      comment,
    });
  } catch (error) {
    console.error("Update comment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating comment",
      error: error.message,
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:commentId
// @access  Private (Comment author only)
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the comment author
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this comment",
      });
    }

    // Soft delete
    comment.isDeleted = true;
    comment.content = "[deleted]";
    await comment.save();

    // Update blog's comment count
    await Blog.findByIdAndUpdate(comment.blog, {
      $inc: { commentsCount: -1 },
    });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting comment",
      error: error.message,
    });
  }
};

// @desc    Like/Unlike a comment
// @route   POST /api/comments/:commentId/like
// @access  Private
exports.toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const userId = req.user._id;
    const likeIndex = comment.likes.indexOf(userId);

    let message;
    if (likeIndex === -1) {
      comment.likes.push(userId);
      message = "Comment liked successfully";
    } else {
      comment.likes.splice(likeIndex, 1);
      message = "Comment unliked successfully";
    }

    await comment.save();

    res.status(200).json({
      success: true,
      message,
      likesCount: comment.likesCount,
      isLiked: likeIndex === -1,
    });
  } catch (error) {
    console.error("Toggle comment like error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling comment like",
      error: error.message,
    });
  }
};
