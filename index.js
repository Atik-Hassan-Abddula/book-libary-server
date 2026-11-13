
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
const uri = process.env.MONGO_DB_URL;

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

    

        const newBook = {
          ...book,
          quantity: Number(book.quantity ?? 1),
          availableQuantity: Number(book.quantity ?? 1),
          createdAt: new Date(),
        };

        const result = await booksCollection.insertOne(newBook);

        res.status(201).send({
          success: true,
          message: "Book added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error(error);

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

run();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
