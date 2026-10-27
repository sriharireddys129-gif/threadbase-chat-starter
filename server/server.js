import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import { verifyToken } from "./middleware/auth.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// Demo users
const USERS = [
  {
    userId: 1,
    name: "Ada",
    email: "ada@threadbase.dev",
    password: "password",
  },
  {
    userId: 2,
    name: "Linus",
    email: "linus@threadbase.dev",
    password: "password",
  },
];

// Root route
app.get("/", (req, res) => {
  res.send("Threadbase backend is running!");
});

// Login route
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};

  const found = USERS.find(
    (user) => user.email === email && user.password === password
  );

  if (!found) {
    return res.status(401).json({
      error: "Invalid credentials",
    });
  }

  const accessToken = jwt.sign(
    {
      userId: found.userId,
      name: found.name,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  return res.json({
    accessToken,
    user: {
      userId: found.userId,
      name: found.name,
    },
  });
});

// Get authenticated user
app.get("/api/me", verifyToken, (req, res) => {
  res.json({
    user: req.user,
  });
});

// Socket.io JWT authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("No token provided"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    socket.data.user = payload;

    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.data.user.name}`);

  // Join a chat room
  socket.on("room:join", (roomId) => {
    if (typeof roomId !== "string" || !roomId.trim()) {
      return;
    }

    socket.join(roomId);

    console.log(`${socket.data.user.name} joined room: ${roomId}`);
  });

  // Send a chat message to everyone in the room
  socket.on("chat:message", ({ roomId, text } = {}) => {
    if (
      typeof roomId !== "string" ||
      !roomId.trim() ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return;
    }

    const message = {
      id: randomUUID(),
      text: text.trim(),
      user: socket.data.user.name,
      at: Date.now(),
    };

    io.to(roomId).emit("chat:message", message);

    console.log(
      `Message from ${socket.data.user.name} in ${roomId}: ${message.text}`
    );
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(
      `User disconnected: ${socket.data.user.name}. Reason: ${reason}`
    );
  });
});

// Start server
const PORT = process.env.PORT ?? 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("POST /auth/login");
  console.log("GET  /api/me");
  console.log("GET  /");
  console.log("Socket.io is ready");
});