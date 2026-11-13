
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
        res.status(500).send({
          success: false,
          message: "Database connection failed",
        });
      }
    });

    // Get All Books
    app.get("/books", async (req, res) => {
      try {
        const books = await booksCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

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

    // Add New Book
    app.post("/books", async (req, res) => {
      try {
        const book = req.body;

        if (!book.title || !book.author) {
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
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

run()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(console.error);
