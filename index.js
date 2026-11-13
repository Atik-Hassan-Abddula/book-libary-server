
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
          collection: "books",
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
    // =====================================

    app.get("/books", async (req, res) => {
      try {
        const limit = Number(req.query.limit);

        let query = booksCollection
          .find()
          .sort({ createdAt: -1 });

        // Homepage: GET /books?limit=6
        if (req.query.limit !== undefined) {
          if (
            !Number.isInteger(limit) ||
            limit < 1
          ) {
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
    // ADD NEW BOOK
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

        // Required field validation
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

        // Quantity validation
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

        // Category validation
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

        // Image URL validation
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

        // New Book Document
        const newBook = {
          title: title.trim(),
          author: author.trim(),
          category: category,
          imageUrl: validImageUrl.toString(),
          description: description.trim(),

          quantity: totalQuantity,
          availableQuantity: totalQuantity,

          userName: userName?.trim() || "",
          userEmail: userEmail.trim().toLowerCase(),

          createdAt: new Date(),
        };

        // Save Book to MongoDB
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
