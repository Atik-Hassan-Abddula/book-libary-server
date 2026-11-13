
import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
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

async function run() {
  try {
    await client.connect();

    const database = client.db("booknook");
    const booksCollection = database.collection("books");

    console.log("MongoDB Connected Successfully!");

    // Root API
    app.get("/", (req, res) => {
      res.send("BookNook Library Server is Running!");
    });

    // Check Database
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

    // Get All Books / Latest 6 Books
    

    // Get Single Book
    app.get("/books/:id", async (req, res) => {
      try {
        const { ObjectId } = await import("mongodb");
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

    // Add New Book
    app.post("/books", async (req, res) => {
      try {
        const book = req.body;

        if (!book.title?.trim() || !book.author?.trim()) {
          return res.status(400).send({
            success: false,
            message: "Book title and author are required",
          });
        }

        const quantity = Number(book.quantity ?? 1);

        if (!Number.isInteger(quantity) || quantity < 1) {
          return res.status(400).send({
            success: false,
            message: "Quantity must be a positive integer",
          });
        }

        const newBook = {
          ...book,
          title: book.title.trim(),
          author: book.author.trim(),
          quantity,
          availableQuantity: quantity,
          createdAt: new Date(),
        };

        const result = await booksCollection.insertOne(newBook);

        res.status(201).send({
          success: true,
          message: "Book added successfully",
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

    // Start Server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

run().catch(console.error);
