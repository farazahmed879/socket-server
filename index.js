const { Server } = require("socket.io");
const fs = require("fs");
const NodeCache = require("node-cache");
const { join } = require("path");
require("dotenv").config();

const io = new Server({ cors: { origin: process.env.FRONTEND_URL } });

// Cache for storing online users in-memory
const onlineUserCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

// Function to load users from the file on server start
function loadOnlineUsers() {
  try {
    const data = fs.readFileSync("onlineUsers.json");
    return JSON.parse(data);
  } catch (err) {
    console.error("No previous users to load.");
    return [];
  }
}

// Function to save the online users to a file
function saveOnlineUsers(users) {
  try {
    fs.writeFileSync("onlineUsers.json", JSON.stringify(users));
  } catch (err) {
    console.error("Error saving online users:", err);
  }
}

// Load users when the server starts
let onlineUsers = loadOnlineUsers();
onlineUsers.forEach((user) => onlineUserCache.set(user.userId, user));

// Save online users periodically (every 1 minute)
setInterval(() => {
  const onlineUsersList = onlineUserCache
    .keys()
    .map((key) => onlineUserCache.get(key));
  saveOnlineUsers(onlineUsersList);
}, 60000); // Every minute

// Setting up socket.io server
io.on("connection", (socket) => {
  // Add a new user to the online users list
  socket.on("addNewUser", (user) => {
    console.log("room", user?._id);
    socket.join(user?._id);
    if (onlineUserCache.has(user?._id)) return;

    const newUser = {
      userId: user?._id,
      socketId: socket.id,
      role: user?.role,
    };

    // Add user to in-memory cache
    onlineUserCache.set(user?._id, newUser);
    io.emit(
      "getOnlineUsers",
      onlineUserCache.keys().map((key) => onlineUserCache.get(key))
    );
    console.log(
      "Updated online users:",
      onlineUserCache.keys().map((key) => onlineUserCache.get(key))
    );
  });

  // Handle incoming message
  socket.on("sendMessage", (message) => {
    console.log("message to", message?.receipientId);
    // const recipient = onlineUserCache.get(message?.receipientId);

    // Send the message to the recipient's room (which is their userId)
    io.to(message?.receipientId).emit("getMessage", message);

    // Optionally send a notification to the recipient
    io.to(message?.receipientId).emit("getNotification", {
      senderId: message.senderId,
      isRead: false,
      date: new Date(),
      message: `${message.senderName} sent you a message`,
    });

    console.log(`Message sent to userId ${message.receipientId}`);
  });

  // Handle incoming chat request
  socket.on("addNewRequest", (request) => {
    console.log("addNewRequest", request);

    onlineUsers.forEach((e) => {
      if (e.role != "NORMAL") {
        io.to(e?.userId).emit("getRequest", request);
        io.to(e?.userId).emit("getNotification", {
          senderId: request?.senderId?._id,
          isRead: false,
          message: `${request?.senderId?.email} requested for a chat`,
          date: new Date(),
        });
      }
    });
  });

  // Handle accepted request
  socket.on("requestAccepted", (chat) => {
    console.log("requestAccepted");
    // const user = onlineUserCache.get(chat.senderId);

    io.emit("getAcceptRequest", chat);
  });

  // Handle chat closure
  socket.on("sendChatClosed", (chat) => {
    console.log("chat", chat);
    io.to(chat?.recipientId).emit("getChatClosed", chat);
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    // Remove the user from the online users list
    onlineUserCache.keys().forEach((userId) => {
      const user = onlineUserCache.get(userId);
      if (user?.socketId === socket.id) {
        onlineUserCache.del(userId);
      }
    });

    // Emit updated online users list
    io.emit(
      "getOnlineUsers",
      onlineUserCache.keys().map((key) => onlineUserCache.get(key))
    );
    // console.log(
    //   "Updated online users after disconnect:",
    //   onlineUserCache.keys().map((key) => onlineUserCache.get(key))
    // );

    // onlineUsers.forEach((e) => {
    //   socket.join(e?.userId);
    // });

    // console.log("onlineUserCache", onlineUsers);
  });
});

// Start listening on port 4000

const PORT = process.env.PORT || 5000;

io.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
