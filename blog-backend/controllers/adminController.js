const Blog = require("../models/Blog");
const User = require("../models/User");
const Comment = require("../models/Comment");

// @desc    Get all pending blogs
// @route   GET /api/admin/blogs/pending
// @access  Private (Admin only)
exports.getPendingBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const blogs = await Blog.find({
      status: "pending",
      isDeleted: false,
    })
      .populate("author", "username fullName email profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Blog.countDocuments({
      status: "pending",
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      count: blogs.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      blogs,
    });
  } catch (error) {
    console.error("Get pending blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pending blogs",
      error: error.message,
    });
  }
};

// @desc    Get all blogs (all statuses) for admin
// @route   GET /api/admin/blogs
// @access  Private (Admin only)
exports.getAllBlogsAdmin = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = "-createdAt",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const blogs = await Blog.find(query)
      .populate("author", "username fullName email profileImage")
      .sort(sortBy)
      .skip(skip)
      .limit(limitNum)
      .select("-content");

    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: blogs.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      blogs,
    });
  } catch (error) {
    console.error("Get all blogs admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching blogs",
      error: error.message,
    });
  }
};

// @desc    Approve a blog
// @route   PUT /api/admin/blogs/:id/approve
// @access  Private (Admin only)
exports.approveBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id).populate(
      "author",
      "username email fullName"
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (blog.status === "published") {
      return res.status(400).json({
        success: false,
        message: "Blog is already published",
      });
    }

    blog.status = "published";
    blog.publishedAt = new Date();
    blog.rejectionReason = ""; // Clear any previous rejection reason
    await blog.save();

    res.status(200).json({
      success: true,
      message: "Blog approved and published successfully",
      blog,
    });
  } catch (error) {
    console.error("Approve blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while approving blog",
      error: error.message,
    });
  }
};

// @desc    Reject a blog
// @route   PUT /api/admin/blogs/:id/reject
// @access  Private (Admin only)
exports.rejectBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const blog = await Blog.findById(id).populate(
      "author",
      "username email fullName"
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    blog.status = "rejected";
    blog.rejectionReason = reason;
    blog.publishedAt = null;
    await blog.save();

    res.status(200).json({
      success: true,
      message: "Blog rejected successfully",
      blog,
    });
  } catch (error) {
    console.error("Reject blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting blog",
      error: error.message,
    });
  }
};

// @desc    Delete blog permanently (admin)
// @route   DELETE /api/admin/blogs/:id
// @access  Private (Admin only)
exports.deleteBlogAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Soft delete
    blog.isDeleted = true;
    await blog.save();

    // Also soft delete all comments associated with this blog
    await Comment.updateMany({ blog: id }, { isDeleted: true });

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting blog",
      error: error.message,
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalBlogs = await Blog.countDocuments({ isDeleted: false });
    const publishedBlogs = await Blog.countDocuments({
      status: "published",
      isDeleted: false,
    });
    const pendingBlogs = await Blog.countDocuments({
      status: "pending",
      isDeleted: false,
    });
    const rejectedBlogs = await Blog.countDocuments({
      status: "rejected",
      isDeleted: false,
    });
    const totalComments = await Comment.countDocuments({ isDeleted: false });

    // Get total views and likes
    const viewsResult = await Blog.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]);
    const totalViews = viewsResult.length > 0 ? viewsResult[0].total : 0;

    const likesResult = await Blog.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$likesCount" } } },
    ]);
    const totalLikes = likesResult.length > 0 ? likesResult[0].total : 0;

    // Get recent blogs
    const recentBlogs = await Blog.find({ isDeleted: false })
      .populate("author", "username fullName")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status createdAt author");

    // Get top authors (by published blogs count)
    const topAuthors = await Blog.aggregate([
      { $match: { status: "published", isDeleted: false } },
      { $group: { _id: "$author", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "authorInfo",
        },
      },
      { $unwind: "$authorInfo" },
      {
        $project: {
          _id: 1,
          count: 1,
          username: "$authorInfo.username",
          fullName: "$authorInfo.fullName",
          profileImage: "$authorInfo.profileImage",
        },
      },
    ]);

    // Category distribution
    const categoryStats = await Blog.aggregate([
      { $match: { status: "published", isDeleted: false } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
        },
        blogs: {
          total: totalBlogs,
          published: publishedBlogs,
          pending: pendingBlogs,
          rejected: rejectedBlogs,
        },
        engagement: {
          totalViews,
          totalLikes,
          totalComments,
        },
        recentBlogs,
        topAuthors,
        categoryStats,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard statistics",
      error: error.message,
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
      ];
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    // Get blog counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const blogCount = await Blog.countDocuments({
          author: user._id,
          isDeleted: false,
        });
        return {
          ...user.toObject(),
          blogCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      users: usersWithStats,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
      error: error.message,
    });
  }
};

// @desc    Toggle user active status
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private (Admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deactivating themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,
      user,
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling user status",
      error: error.message,
    });
  }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "user" or "admin"',
      });
    }

    // Prevent admin from changing their own role
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`,
      user,
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating user role",
      error: error.message,
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Soft delete user's blogs and comments
    await Blog.updateMany({ author: id }, { isDeleted: true });
    await Comment.updateMany({ user: id }, { isDeleted: true });

    // Deactivate user instead of deleting
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting user",
      error: error.message,
    });
  }
};

// @desc    Get all comments (for moderation)
// @route   GET /api/admin/comments
// @access  Private (Admin only)
exports.getAllComments = async (req, res) => {
  try {
    const { page = 1, limit = 20, blogId } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { isDeleted: false };

    if (blogId) {
      query.blog = blogId;
    }

    const comments = await Comment.find(query)
      .populate("user", "username fullName profileImage")
      .populate("blog", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Comment.countDocuments(query);

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      comments,
    });
  } catch (error) {
    console.error("Get all comments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching comments",
      error: error.message,
    });
  }
};

// @desc    Delete comment (admin)
// @route   DELETE /api/admin/comments/:id
// @access  Private (Admin only)
exports.deleteCommentAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    comment.isDeleted = true;
    comment.content = "[deleted by admin]";
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
    console.error("Delete comment admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting comment",
      error: error.message,
    });
  }
};
