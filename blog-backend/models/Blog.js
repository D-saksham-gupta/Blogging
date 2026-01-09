const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [50, "Content must be at least 50 characters"],
    },
    excerpt: {
      type: String,
      maxlength: [300, "Excerpt cannot exceed 300 characters"],
    },
    coverImage: {
      type: String,
      default: "",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
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
      ],
      default: "Other",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "published", "rejected"],
      default: "pending",
    },
    publishedAt: {
      type: Date,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    readTime: {
      type: Number, // in minutes
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Create slug from title before saving
blogSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug =
      this.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now();
  }

  // Calculate read time (average reading speed: 200 words per minute)
  if (this.isModified("content")) {
    const wordCount = this.content.split(/\s+/).length;
    this.readTime = Math.ceil(wordCount / 200);
  }

  // Auto-generate excerpt if not provided
  if (this.isModified("content") && !this.excerpt) {
    this.excerpt = this.content.substring(0, 150) + "...";
  }

  next();
});

// Update likesCount when likes array changes
blogSchema.pre("save", function (next) {
  if (this.isModified("likes")) {
    this.likesCount = this.likes.length;
  }
  next();
});

// Indexes for better query performance
blogSchema.index({ author: 1, status: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ title: "text", content: "text" }); // Text search

module.exports = mongoose.model("Blog", blogSchema);
