const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const PORT = process.env.PORT || 5000;

// Step 1: Create an HTTP Server
const httpServer = createServer();

// Step 2: Attach Socket.IO to the server
const io = new Server(httpServer, { cors: { origin: "*" } });

// Step 3: Set up connection event
let onlineUsers = [];

// Setting up socket.io server
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Add a new user to the online users list
  socket.on("addNewUser", (user) => {
    if (!user?._id) return;
    socket.join(user._id);

    if (onlineUsers.some((u) => u.userId === user._id)) return;

    const newUser = {
      userId: user._id,
      socketId: socket.id,
      role: user.role,
    };

    onlineUsers.push(newUser);
    io.emit("getOnlineUsers", onlineUsers);
    console.log(`User added: ${user._id}`);
  });

  // Handle incoming messages
  socket.on("sendMessage", (message) => {
    if (!message?.recipientId) return;
    console.log(`Message sent to ${message.recipientId}`);
    io.to(message.recipientId).emit("getMessage", message);
    io.to(message.recipientId).emit("getNotification", {
      senderId: message.senderId,
      isRead: false,
      date: new Date(),
      message: `${message.senderName} sent you a message`,
    });
  });

  // Handle new chat requests
  socket.on("addNewRequest", (request) => {
    console.log("New chat request:", request);
    onlineUsers.forEach((user) => {
      if (user.role !== "NORMAL") {
        io.to(user.userId).emit("getRequest", request);
        io.to(user.userId).emit("getNotification", {
          senderId: request?.senderId?._id,
          isRead: false,
          message: `${request?.senderId?.email} requested for a chat`,
          date: new Date(),
        });
      }
    });
  });

  // Handle accepted chat requests
  socket.on("requestAccepted", (chat) => {
    io.emit("getAcceptRequest", chat);
  });

  // Handle chat closure
  socket.on("sendChatClosed", (chat) => {
    io.to(chat?.recipientId).emit("getChatClosed", chat);
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    const index = onlineUsers.findIndex((user) => user.socketId === socket.id);
    if (index !== -1) {
      const disconnectedUser = onlineUsers.splice(index, 1)[0];
      io.emit("getOnlineUsers", onlineUsers);
      console.log(`User disconnected: ${disconnectedUser.userId}`);
    }
  });
});

// Step 5: Start the server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}...`);
});
