
import express from "express";
import {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} from "mongodb";

import cors from "cors";
import "dotenv/config";

// =====================================
// INITIAL CONFIGURATION
// =====================================

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());
app.use(express.json());

// =====================================
// MONGODB CONNECTION
// =====================================

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing from .env file");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// =====================================
// DATABASE
// =====================================

async function run() {
  try {
    await client.connect();

    const database = client.db("booknook");

    const booksCollection = database.collection("books");
    const borrowsCollection = database.collection("borrows");

    console.log("MongoDB Connected Successfully!");

    // =====================================
    // ROOT API
    // =====================================

    app.get("/", (req, res) => {
      res.status(200).send(
        "BookNook Library Server is Running!"
      );
    });

    // =====================================
    // CHECK DATABASE
    // =====================================

    app.get("/health", async (req, res) => {
      try {
        await client.db("admin").command({ ping: 1 });

        res.status(200).send({
          success: true,
          message: "MongoDB is connected",
          database: "booknook",
          collections: ["books", "borrows"],
        });
      } catch (error) {
        console.error("Health Check Error:", error);

        res.status(500).send({
          success: false,
          message: "Database connection failed",
        });
      }
    });

    // =====================================
    // GET ALL BOOKS / LATEST BOOKS
    // GET /books
    // =====================================

    app.get("/books", async (req, res) => {
      try {
        const limit = Number(req.query.limit);

        let query = booksCollection
          .find()
          .sort({ createdAt: -1 });

        if (req.query.limit !== undefined) {
          if (!Number.isInteger(limit) || limit < 1) {
            return res.status(400).send({
              success: false,
              message: "Limit must be a positive integer",
            });
          }

          query = query.limit(Math.min(limit, 100));
        }

        const books = await query.toArray();

        res.status(200).send({
          success: true,
          totalBooks: books.length,
          data: books,
        });
      } catch (error) {
        console.error("Get Books Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch books",
        });
      }
    });

    // =====================================
    // GET SINGLE BOOK
    // GET /books/:id
    // =====================================

    app.get("/books/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid book ID",
          });
        }

        const book = await booksCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!book) {
          return res.status(404).send({
            success: false,
            message: "Book not found",
          });
        }

        res.status(200).send({
          success: true,
          data: book,
        });
      } catch (error) {
        console.error("Get Single Book Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch book",
        });
      }
    });

    // =====================================
    // GET MY ADDED BOOKS
    // GET /my-books?email=user@email.com
    // =====================================

    app.get("/my-books", async (req, res) => {
      try {
        const email = req.query.email
          ?.trim()
          .toLowerCase();

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "User email is required",
          });
        }

        const myBooks = await booksCollection
          .find({
            userEmail: email,
          })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).send({
          success: true,
          totalBooks: myBooks.length,
          data: myBooks,
        });
      } catch (error) {
        console.error("Get My Books Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch your books",
        });
      }
    });

    // =====================================
    // ADD NEW BOOK
    // POST /books
    // =====================================

    app.post("/books", async (req, res) => {
      try {
        const {
          title,
          author,
          category,
          imageUrl,
          description,
          quantity,
          userName,
          userEmail,
        } = req.body;

        if (
          !title?.trim() ||
          !author?.trim() ||
          !category?.trim() ||
          !imageUrl?.trim() ||
          !description?.trim() ||
          !userEmail?.trim()
        ) {
          return res.status(400).send({
            success: false,
            message: "Please fill in all required fields.",
          });
        }

        const totalQuantity = Number(quantity);

        if (
          !Number.isInteger(totalQuantity) ||
          totalQuantity < 1
        ) {
          return res.status(400).send({
            success: false,
            message: "Quantity must be a positive integer.",
          });
        }

        const allowedCategories = [
          "Fiction",
          "Science",
          "History",
          "Kids",
          "Others",
        ];

        if (!allowedCategories.includes(category)) {
          return res.status(400).send({
            success: false,
            message: "Invalid book category.",
          });
        }

        let validImageUrl;

        try {
          validImageUrl = new URL(imageUrl.trim());

          if (
            !["http:", "https:"].includes(
              validImageUrl.protocol
            )
          ) {
            throw new Error("Invalid image URL");
          }
        } catch {
          return res.status(400).send({
            success: false,
            message: "Please provide a valid image URL.",
          });
        }

        const newBook = {
          title: title.trim(),
          author: author.trim(),
          category,
          imageUrl: validImageUrl.toString(),
          description: description.trim(),
          quantity: totalQuantity,
          availableQuantity: totalQuantity,
          userName: userName?.trim() || "",
          userEmail: userEmail.trim().toLowerCase(),
          createdAt: new Date(),
        };

        const result = await booksCollection.insertOne(
          newBook
        );

        res.status(201).send({
          success: true,
          message: "Book added successfully!",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Add Book Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to add book",
        });
      }
    });

    // =====================================
    // BORROW A BOOK
    // POST /borrow
    // =====================================

    app.post("/borrow", async (req, res) => {
      let reservedBookId = null;

      try {
        const {
          bookId,
          userName,
          userEmail,
          borrowDays = 7,
        } = req.body;

        if (
          !bookId ||
          !ObjectId.isValid(bookId) ||
          !userEmail?.trim()
        ) {
          return res.status(400).send({
            success: false,
            message: "Valid book ID and user email are required.",
          });
        }

        const days = Number(borrowDays);

        if (
          !Number.isInteger(days) ||
          days < 1 ||
          days > 30
        ) {
          return res.status(400).send({
            success: false,
            message: "Borrow days must be between 1 and 30.",
          });
        }

        const bookObjectId = new ObjectId(bookId);
        const normalizedEmail = userEmail.trim().toLowerCase();

        // Atomically decrease available quantity.
        const updatedBook = await booksCollection.findOneAndUpdate(
          {
            _id: bookObjectId,
            availableQuantity: { $gt: 0 },
          },
          {
            $inc: { availableQuantity: -1 },
          },
          {
            returnDocument: "after",
          }
        );

        if (!updatedBook) {
          const existingBook = await booksCollection.findOne({
            _id: bookObjectId,
          });

          if (!existingBook) {
            return res.status(404).send({
              success: false,
              message: "Book not found.",
            });
          }

          return res.status(409).send({
            success: false,
            message: "This book is currently unavailable.",
          });
        }

        reservedBookId = bookObjectId;

        const borrowDate = new Date();
        const returnDate = new Date(borrowDate);

        returnDate.setDate(returnDate.getDate() + days);

        const borrowDocument = {
          bookId: bookObjectId,
          title: updatedBook.title,
          author: updatedBook.author,
          category: updatedBook.category,
          imageUrl: updatedBook.imageUrl,
          userName: userName?.trim() || "",
          userEmail: normalizedEmail,
          borrowDate,
          returnDate,
          borrowDays: days,
          status: "borrowed",
          createdAt: new Date(),
        };

        const result = await borrowsCollection.insertOne(
          borrowDocument
        );

        reservedBookId = null;

        res.status(201).send({
          success: true,
          message: "Book borrowed successfully!",
          data: {
            ...borrowDocument,
            _id: result.insertedId,
          },
        });
      } catch (error) {
        console.error("Borrow Book Error:", error);

        // Restore quantity if saving the borrow record failed.
        if (reservedBookId) {
          try {
            await booksCollection.updateOne(
              { _id: reservedBookId },
              { $inc: { availableQuantity: 1 } }
            );
          } catch (restoreError) {
            console.error(
              "Quantity Restore Error:",
              restoreError
            );
          }
        }

        res.status(500).send({
          success: false,
          message: "Failed to borrow book.",
        });
      }
    });

    // =====================================
    // GET MY BORROWED BOOKS
    // GET /my-borrows?email=user@email.com
    // =====================================

    app.get("/my-borrows", async (req, res) => {
      try {
        const email = req.query.email
          ?.trim()
          .toLowerCase();

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "User email is required.",
          });
        }

        const borrowedBooks = await borrowsCollection
          .find({
            userEmail: email,
            status: "borrowed",
          })
          .sort({ borrowDate: -1 })
          .toArray();

        res.status(200).send({
          success: true,
          totalBorrows: borrowedBooks.length,
          data: borrowedBooks,
        });
      } catch (error) {
        console.error("Get My Borrows Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to fetch borrowed books.",
        });
      }
    });

    // =====================================
    // RETURN A BORROWED BOOK
    // PATCH /borrow/:borrowId/return
    // =====================================

    app.patch("/borrow/:borrowId/return", async (req, res) => {
      try {
        const { borrowId } = req.params;

        if (!ObjectId.isValid(borrowId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid borrow ID.",
          });
        }

        const borrowObjectId = new ObjectId(borrowId);

        // Change status only if currently borrowed.
        const borrowResult = await borrowsCollection.updateOne(
          {
            _id: borrowObjectId,
            status: "borrowed",
          },
          {
            $set: {
              status: "returned",
              returnedAt: new Date(),
            },
          }
        );

        if (borrowResult.matchedCount === 0) {
          const existingBorrow = await borrowsCollection.findOne({
            _id: borrowObjectId,
          });

          if (!existingBorrow) {
            return res.status(404).send({
              success: false,
              message: "Borrow record not found.",
            });
          }

          return res.status(409).send({
            success: false,
            message: "This book has already been returned.",
          });
        }

        const borrowRecord = await borrowsCollection.findOne({
          _id: borrowObjectId,
        });

        // Increase available book quantity.
        const quantityResult = await booksCollection.updateOne(
          {
            _id: borrowRecord.bookId,
          },
          {
            $inc: { availableQuantity: 1 },
          }
        );

        if (quantityResult.matchedCount === 0) {
          // Restore borrow status if original book is missing.
          await borrowsCollection.updateOne(
            {
              _id: borrowObjectId,
              status: "returned",
            },
            {
              $set: { status: "borrowed" },
              $unset: { returnedAt: "" },
            }
          );

          return res.status(404).send({
            success: false,
            message: "Original book record not found.",
          });
        }

        res.status(200).send({
          success: true,
          message: "Book returned successfully!",
        });
      } catch (error) {
        console.error("Return Book Error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to return book.",
        });
      }
    });

    // =====================================
    // START SERVER
    // =====================================

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Server URL: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

// =====================================
// RUN SERVER
// =====================================

run().catch(console.error);
