# 📚 BookNook Backend — Online Library API

BookNook Backend is a RESTful API built with Node.js and Express.js for the BookNook online library management application.

It handles user authentication, book management, borrowing and returning books, and database operations using MongoDB.

## 🌐 Live API

- **Backend URL:** https://book-libary-server.vercel.app/
- **Health Check:** https://book-libary-server.vercel.app/health
- **Frontend:** `YOUR_FRONTEND_VERCEL_URL`

## ✨ Features

- **User Registration:** Create a new account with email and password.
- **User Login:** Authenticate users securely.
- **Google Authentication:** Support Google login through a secure authentication exchange.
- **JWT Authentication:** Protect private API endpoints using JSON Web Tokens.
- **Password Security:** Hash passwords using bcryptjs.
- **Book Management:** Create, retrieve, and delete books.
- **Book Details:** Retrieve individual book information.
- **My Books:** Retrieve books added by the authenticated user.
- **Borrow Books:** Allow authenticated users to borrow books.
- **My Borrows:** Retrieve the user's borrowing records.
- **Return Books:** Return previously borrowed books.
- **MongoDB Integration:** Store users, books, and borrowing records.
- **CORS Configuration:** Allow requests from the authorized frontend.
- **Health Check:** Verify backend availability.

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB Native Driver
- JSON Web Token (JWT)
- bcryptjs
- CORS
- dotenv
- Vercel
- JavaScript (ES Modules)

## 📁 Project Structure

```text
book-libary-server/
├── api/
│   └── index.js
├── middleware/
│   └── verifyToken.js
├── index.js
├── package.json
├── package-lock.json
├── vercel.json
├── .env
├── .gitignore
└── README.md
```

*Note: Adjust this structure to match the actual files in your repository.*

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_BACKEND_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the Project

```bash
cd book-libary-server
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000

MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING

JWT_SECRET=YOUR_LONG_RANDOM_JWT_SECRET

JWT_EXPIRES_IN=1d

AUTH_EXCHANGE_SECRET=YOUR_AUTH_EXCHANGE_SECRET

CLIENT_URL=http://localhost:3000
```

**Important:** Never upload `.env` or expose database credentials and authentication secrets on GitHub.

### 5. Run the Development Server

```bash
npm run dev
```

Backend will run locally at:

```text
http://localhost:5000
```

### 6. Run in Production Mode

```bash
npm start
```

## 🔗 API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login user |
| POST | `/auth/google-exchange` | Exchange Google session for backend JWT |
| GET | `/auth/me` | Get authenticated user |

### Books

| Method | Endpoint | Description |
|---|---|---|
| GET | `/books` | Get all books |
| GET | `/books/:id` | Get book details |
| POST | `/books` | Add a new book |
| DELETE | `/books/:id` | Delete a book |
| GET | `/my-books` | Get books added by current user |

### Borrowing

| Method | Endpoint | Description |
|---|---|---|
| POST | `/borrow` | Borrow a book |
| GET | `/my-borrows` | Get current user's borrowed books |
| PATCH | `/borrow/:borrowId/return` | Return a borrowed book |

**Authentication:** Protected endpoints require a valid JWT token in the Authorization header.

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🗄️ Database

BookNook uses MongoDB to store application data.

Main collections:

- `users` — User account information.
- `books` — Library book information.
- `borrows` — Borrowing and return records.

## 🚀 Deployment on Vercel

The backend is deployed on Vercel.

### Environment Variables

Add these variables in:

Vercel Dashboard → Project → Settings → Environment Variables

```env
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_LONG_RANDOM_JWT_SECRET
JWT_EXPIRES_IN=1d
AUTH_EXCHANGE_SECRET=YOUR_AUTH_EXCHANGE_SECRET
CLIENT_URL=YOUR_FRONTEND_VERCEL_URL
```

### Deploy Using Vercel CLI

Install Vercel CLI:

```bash
npm install -g vercel
```

Login:

```bash
vercel login
```

Deploy:

```bash
vercel
```

Production deployment:

```bash
vercel --prod
```

## 🧪 API Testing

Test the deployed backend:

**Root Endpoint:**

https://book-libary-server.vercel.app/

**Health Check:**

https://book-libary-server.vercel.app/health

**All Books:**

https://book-libary-server.vercel.app/books

## 🔐 Security Practices

- Passwords are hashed before storage.
- Private routes use JWT verification.
- Sensitive environment variables are not exposed to frontend code.
- Google authentication exchange uses a server-side shared secret.
- CORS is configured for authorized frontend origins.
- Database credentials must remain private.

## 🎯 Project Purpose

This backend was developed for BookNook, an online library management platform. It demonstrates REST API development, authentication, database integration, secure route handling, and serverless deployment.

## 👨‍💻 Developer

**Atik Hasan**

- GitHub: https://github.com/Atik-Hassan-Abddula
- LinkedIn: https://www.linkedin.com/in/atik-hassan-687022440/

---

**BookNook — Read More, Discover More! 📖**
