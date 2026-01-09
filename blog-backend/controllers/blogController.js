const Blog = require("../models/Blog");
const Comment = require("../models/Comment");
const { validationResult } = require("express-validator");

// @desc    Create a new blog
// @route   POST /api/blogs
// @access  Private
exports.createBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { title, content, excerpt, coverImage, category, tags } = req.body;

    const blog = await Blog.create({
      title,
      content,
      excerpt,
      coverImage: coverImage || "",
      category,
      tags: tags || [],
      author: req.user._id,
      status: "pending", // All blogs start as pending
    });

    // Populate author details
    await blog.populate("author", "username fullName profileImage");

    res.status(201).json({
      success: true,
      message: "Blog created successfully and sent for approval",
      blog,
    });
  } catch (error) {
    console.error("Create blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating blog",
      error: error.message,
    });
  }
};

// @desc    Get all published blogs with filters and sorting
// @route   GET /api/blogs
// @access  Public
exports.getAllBlogs = async (req, res) => {
  try {
    const {
      category,
      search,
      sort = "-publishedAt", // Default: newest first
      page = 1,
      limit = 10,
      author,
    } = req.query;

    // Build query
    const query = { status: "published", isDeleted: false };

    // Filter by category
    if (category && category !== "All") {
      query.category = category;
    }

    // Filter by author
    if (author) {
      query.author = author;
    }

    // Search in title and content
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting options
    let sortOption;
    switch (sort) {
      case "oldest":
        sortOption = { publishedAt: 1 };
        break;
      case "views":
        sortOption = { views: -1 };
        break;
      case "likes":
        sortOption = { likesCount: -1 };
        break;
      case "comments":
        sortOption = { commentsCount: -1 };
        break;
      default: // 'newest' or '-publishedAt'
        sortOption = { publishedAt: -1 };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const blogs = await Blog.find(query)
      .populate("author", "username fullName profileImage")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .select("-content"); // Exclude full content for list view

    // Get total count for pagination
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
    console.error("Get blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching blogs",
      error: error.message,
    });
  }
};

// @desc    Get single blog by slug
// @route   GET /api/blogs/:slug
// @access  Public
exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({
      slug,
      isDeleted: false,
    }).populate("author", "username fullName profileImage bio");

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment views (only if not the author viewing their own blog)
    if (!req.user || req.user._id.toString() !== blog.author._id.toString()) {
      blog.views += 1;
      await blog.save();
    }

    res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching blog",
      error: error.message,
    });
  }
};

// @desc    Get user's own blogs (all statuses)
// @route   GET /api/blogs/my-blogs
// @access  Private
exports.getMyBlogs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {
      author: req.user._id,
      isDeleted: false,
    };

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const blogs = await Blog.find({ author: req.user._id, isDeleted: false });

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
    console.error("Get my blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching your blogs",
      error: error.message,
    });
  }
};

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Private (Author only)
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, coverImage, category, tags } = req.body;

    let blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Check if user is the author
    if (blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this blog",
      });
    }

    // Update fields
    if (title) blog.title = title;
    if (content) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (coverImage !== undefined) blog.coverImage = coverImage;
    if (category) blog.category = category;
    if (tags) blog.tags = tags;

    // If blog was published and content changed, set back to pending
    if (blog.status === "published" && (title || content)) {
      blog.status = "pending";
      blog.publishedAt = null;
    }

    await blog.save();
    await blog.populate("author", "username fullName profileImage");

    res.status(200).json({
      success: true,
      message:
        blog.status === "pending"
          ? "Blog updated and sent for approval"
          : "Blog updated successfully",
      blog,
    });
  } catch (error) {
    console.error("Update blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating blog",
      error: error.message,
    });
  }
};

// @desc    Delete blog (soft delete)
// @route   DELETE /api/blogs/:id
// @access  Private (Author only)
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Check if user is the author
    if (blog.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this blog",
      });
    }

    // Soft delete
    blog.isDeleted = true;
    await blog.save();

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting blog",
      error: error.message,
    });
  }
};

// @desc    Like/Unlike a blog
// @route   POST /api/blogs/:id/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (blog.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "Cannot like unpublished blog",
      });
    }

    const userId = req.user._id;
    const likeIndex = blog.likes.indexOf(userId);

    let message;
    if (likeIndex === -1) {
      // User hasn't liked yet, add like
      blog.likes.push(userId);
      message = "Blog liked successfully";
    } else {
      // User already liked, remove like
      blog.likes.splice(likeIndex, 1);
      message = "Blog unliked successfully";
    }

    await blog.save();

    res.status(200).json({
      success: true,
      message,
      likesCount: blog.likesCount,
      isLiked: likeIndex === -1,
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling like",
      error: error.message,
    });
  }
};

// @desc    Get blog statistics
// @route   GET /api/blogs/:id/stats
// @access  Public
exports.getBlogStats = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        views: blog.views,
        likes: blog.likesCount,
        comments: blog.commentsCount,
        readTime: blog.readTime,
      },
    });
  } catch (error) {
    console.error("Get blog stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching blog stats",
      error: error.message,
    });
  }
};

// @desc    Get trending/popular blogs
// @route   GET /api/blogs/trending
// @access  Public
exports.getTrendingBlogs = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    // Get blogs from last 7 days, sorted by views + likes
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const blogs = await Blog.find({
      status: "published",
      isDeleted: false,
      publishedAt: { $gte: sevenDaysAgo },
    })
      .populate("author", "username fullName profileImage")
      .sort({ views: -1, likesCount: -1 })
      .limit(parseInt(limit))
      .select("-content");

    res.status(200).json({
      success: true,
      count: blogs.length,
      blogs,
    });
  } catch (error) {
    console.error("Get trending blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching trending blogs",
      error: error.message,
    });
  }
};

// @desc    Get related blogs (same category, exclude current)
// @route   GET /api/blogs/:id/related
// @access  Public
exports.getRelatedBlogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const relatedBlogs = await Blog.find({
      _id: { $ne: id },
      category: blog.category,
      status: "published",
      isDeleted: false,
    })
      .populate("author", "username fullName profileImage")
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select("-content");

    res.status(200).json({
      success: true,
      count: relatedBlogs.length,
      blogs: relatedBlogs,
    });
  } catch (error) {
    console.error("Get related blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching related blogs",
      error: error.message,
    });
  }
};
