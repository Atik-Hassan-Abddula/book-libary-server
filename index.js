
import express from "express";
import {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} from "mongodb";
import cors from "cors";
import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

import verifyToken from "./middleware/verifyToken.js";

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================
// ENVIRONMENT VARIABLES
// =====================================

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
const AUTH_EXCHANGE_SECRET =
  process.env.AUTH_EXCHANGE_SECRET?.trim();

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is missing from .env");
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

if (!AUTH_EXCHANGE_SECRET) {
  throw new Error("AUTH_EXCHANGE_SECRET is missing from .env");
}

// =====================================
// MIDDLEWARE
// =====================================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-auth-exchange-secret",
    ],
  })
);

app.use(express.json());

// =====================================
// MONGODB CONNECTION
// =====================================

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database;
let usersCollection;
let booksCollection;
let borrowsCollection;

// =====================================
// JWT TOKEN
// =====================================

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
};

// =====================================
// SAFE USER
// =====================================

const getSafeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  image: user.image || "",
});

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {
  res.send("BookNook API is running!");
});

// =====================================
// HEALTH CHECK
// =====================================

app.get("/health", async (req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "MongoDB is connected",
      database: "booknook",
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "MongoDB connection failed",
    });
  }
});

// =====================================
// REGISTER
// =====================================

app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, image } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const existingUser = await usersCollection.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = {
      name: trimmedName,
      email: normalizedEmail,
      image: typeof image === "string" ? image.trim() : "",
      password: hashedPassword,
      createdAt: new Date(),
      provider: "credentials",
    };

    const result = await usersCollection.insertOne(newUser);

    const user = {
      _id: result.insertedId,
      name: newUser.name,
      email: newUser.email,
      image: newUser.image,
    };

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message:
        error.code === 11000
          ? "An account with this email already exists."
          : "Registration failed. Please try again.",
    });
  }
});

// =====================================
// LOGIN
// =====================================

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await usersCollection.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatched = user.password
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const safeUser = getSafeUser(user);
    const token = generateToken(safeUser);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// =====================================
// GOOGLE AUTHENTICATION EXCHANGE
// =====================================

app.post("/auth/google-exchange", async (req, res) => {
  try {
    const receivedSecret = req.headers["x-auth-exchange-secret"];

    const expectedSecret =
      process.env.AUTH_EXCHANGE_SECRET?.trim();

    const actualSecret =
      typeof receivedSecret === "string"
        ? receivedSecret.trim()
        : "";

    // Debug information (never print actual secrets)
    console.log("========== GOOGLE EXCHANGE DEBUG ==========");
    console.log("Received secret exists:", Boolean(actualSecret));
    console.log("Expected secret exists:", Boolean(expectedSecret));
    console.log("Received secret length:", actualSecret.length);
    console.log("Expected secret length:", expectedSecret?.length || 0);
    console.log("===========================================");

    // Secret verification
    if (
      !actualSecret ||
      !expectedSecret ||
      Buffer.byteLength(actualSecret) !==
        Buffer.byteLength(expectedSecret) ||
      !timingSafeEqual(
        Buffer.from(actualSecret),
        Buffer.from(expectedSecret)
      )
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized Google authentication request.",
      });
    }

    // Verify Google account information
    const { name, email, image, emailVerified } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      emailVerified !== true
    ) {
      return res.status(400).json({
        success: false,
        message: "Verified Google account information is required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedName || !emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google account information.",
      });
    }

    let user = await usersCollection.findOne({
      email: normalizedEmail,
    });

    // Create Google user if not found
    if (!user) {
      const newUser = {
        name: trimmedName,
        email: normalizedEmail,
        image: typeof image === "string" ? image.trim() : "",
        createdAt: new Date(),
        provider: "google",
      };

      try {
        const result = await usersCollection.insertOne(newUser);

        user = {
          _id: result.insertedId,
          ...newUser,
        };
      } catch (insertError) {
        if (insertError.code !== 11000) {
          throw insertError;
        }

        user = await usersCollection.findOne({
          email: normalizedEmail,
        });
      }
    }

    if (!user) {
      throw new Error("Unable to find or create Google user.");
    }

    const safeUser = getSafeUser(user);
    const token = generateToken(safeUser);

    return res.status(200).json({
      success: true,
      message: "Google login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Google exchange error:", error);

    return res.status(500).json({
      success: false,
      message: "Google authentication failed.",
    });
  }
});

// =====================================
// CURRENT USER
// =====================================

app.get("/auth/me", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user information.",
      });
    }

    const user = await usersCollection.findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: getSafeUser(user),
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get current user.",
    });
  }
});

// =====================================
// GET ALL BOOKS
// =====================================

app.get("/books", async (req, res) => {
  try {
    const books = await booksCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      message: "Books fetched successfully.",
      books,
    });
  } catch (error) {
    console.error("Get books error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch books.",
    });
  }
});

// =====================================
// GET SINGLE BOOK
// =====================================

app.get("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    return res.status(200).json({
      success: true,
      book,
    });
  } catch (error) {
    console.error("Get single book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch book details.",
    });
  }
});

// =====================================
// GET MY BOOKS
// =====================================

app.get("/my-books", verifyToken, async (req, res) => {
  try {
    const books = await booksCollection
      .find({ addedBy: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      books,
    });
  } catch (error) {
    console.error("Get my books error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your books.",
    });
  }
});

// =====================================
// ADD BOOK
// =====================================

app.post("/books", verifyToken, async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      description,
      image,
      quantity,
    } = req.body;

    if (
      typeof title !== "string" ||
      typeof author !== "string" ||
      typeof category !== "string" ||
      typeof description !== "string" ||
      typeof image !== "string" ||
      !title.trim() ||
      !author.trim() ||
      !category.trim() ||
      !description.trim() ||
      !image.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all valid book information.",
      });
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive whole number.",
      });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      description: description.trim(),
      image: image.trim(),
      quantity: parsedQuantity,
      availableQuantity: parsedQuantity,
      addedBy: req.user.email,
      addedByName: req.user.name,
      createdAt: new Date(),
    };

    const result = await booksCollection.insertOne(newBook);

    return res.status(201).json({
      success: true,
      message: "Book added successfully.",
      book: {
        _id: result.insertedId,
        ...newBook,
      },
    });
  } catch (error) {
    console.error("Add book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add book.",
    });
  }
});

// =====================================
// DELETE BOOK
// =====================================

app.delete("/books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    if (book.addedBy !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You can only delete books added by you.",
      });
    }

    const activeBorrow = await borrowsCollection.findOne({
      bookId: id,
      status: "borrowed",
    });

    if (activeBorrow) {
      return res.status(409).json({
        success: false,
        message: "This book cannot be deleted while it is borrowed.",
      });
    }

    await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
    });
  } catch (error) {
    console.error("Delete book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete book.",
    });
  }
});

// =====================================
// BORROW BOOK
// =====================================

app.post("/borrow", verifyToken, async (req, res) => {
  try {
    const { bookId, days } = req.body;

    if (!bookId || !ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "A valid book ID is required.",
      });
    }

    const borrowDays = Number(days);

    if (
      !Number.isInteger(borrowDays) ||
      borrowDays < 1 ||
      borrowDays > 30
    ) {
      return res.status(400).json({
        success: false,
        message: "Borrow duration must be between 1 and 30 days.",
      });
    }

    const book = await booksCollection.findOne({
      _id: new ObjectId(bookId),
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    const alreadyBorrowed = await borrowsCollection.findOne({
      bookId,
      userId: req.user.userId,
      status: "borrowed",
    });

    if (alreadyBorrowed) {
      return res.status(409).json({
        success: false,
        message: "You have already borrowed this book.",
      });
    }

    const borrowedAt = new Date();
    const dueDate = new Date(borrowedAt);
    dueDate.setDate(dueDate.getDate() + borrowDays);

    const borrowRecord = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image || "",
      userId: req.user.userId,
      userName: req.user.name,
      userEmail: req.user.email,
      borrowedAt,
      dueDate,
      days: borrowDays,
      status: "borrowed",
      returnedAt: null,
    };

    const updateResult = await booksCollection.updateOne(
      {
        _id: new ObjectId(bookId),
        availableQuantity: { $gte: 1 },
      },
      {
        $inc: { availableQuantity: -1 },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "This book is no longer available.",
      });
    }

    try {
      const borrowResult = await borrowsCollection.insertOne(
        borrowRecord
      );

      return res.status(201).json({
        success: true,
        message: "Book borrowed successfully.",
        borrow: {
          _id: borrowResult.insertedId,
          ...borrowRecord,
        },
      });
    } catch (insertError) {
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { availableQuantity: 1 } }
      );

      throw insertError;
    }
  } catch (error) {
    console.error("Borrow book error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to borrow book.",
    });
  }
});

// =====================================
// GET MY BORROWS
// =====================================

app.get("/my-borrows", verifyToken, async (req, res) => {
  try {
    const borrows = await borrowsCollection
      .find({
        userId: req.user.userId,
        status: "borrowed",
      })
      .sort({ borrowedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      message: "Active borrowed books fetched successfully.",
      borrows,
    });
  } catch (error) {
    console.error("Get my borrows error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch borrowed books.",
    });
  }
});

// =====================================
// RETURN BOOK
// =====================================

app.patch(
  "/borrow/:borrowId/return",
  verifyToken,
  async (req, res) => {
    try {
      const { borrowId } = req.params;

      if (!ObjectId.isValid(borrowId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid borrow ID.",
        });
      }

      const updateResult = await borrowsCollection.findOneAndUpdate(
        {
          _id: new ObjectId(borrowId),
          userId: req.user.userId,
          status: "borrowed",
        },
        {
          $set: {
            status: "returned",
            returnedAt: new Date(),
          },
        },
        {
          returnDocument: "before",
        }
      );

      // MongoDB driver versions may return either a document
      // or a ModifyResult object.
      const borrow = updateResult?.value ?? updateResult;

      if (!borrow) {
        const existingBorrow = await borrowsCollection.findOne({
          _id: new ObjectId(borrowId),
          userId: req.user.userId,
        });

        if (!existingBorrow) {
          return res.status(404).json({
            success: false,
            message: "Borrow record not found.",
          });
        }

        return res.status(409).json({
          success: false,
          message: "This book has already been returned.",
        });
      }

      const bookUpdate = await booksCollection.updateOne(
        { _id: new ObjectId(borrow.bookId) },
        { $inc: { availableQuantity: 1 } }
      );

      if (bookUpdate.matchedCount === 0) {
        await borrowsCollection.updateOne(
          {
            _id: new ObjectId(borrowId),
            status: "returned",
          },
          {
            $set: {
              status: "borrowed",
              returnedAt: null,
            },
          }
        );

        return res.status(404).json({
          success: false,
          message: "Original book not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Book returned successfully.",
      });
    } catch (error) {
      console.error("Return book error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to return book.",
      });
    }
  }
);

// =====================================
// 404 ROUTE
// =====================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================
// GLOBAL ERROR HANDLER
// =====================================

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: "Something went wrong on the server.",
  });
});

// =====================================
// START SERVER
// =====================================

const run = async () => {
  try {
    await client.connect();

    database = client.db("booknook");

    usersCollection = database.collection("users");
    booksCollection = database.collection("books");
    borrowsCollection = database.collection("borrows");

    await usersCollection.createIndex(
      { email: 1 },
      { unique: true }
    );

    console.log("MongoDB Connected Successfully!");
    console.log("Database: booknook");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Server URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

run();
