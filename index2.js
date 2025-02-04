const { Server } = require("socket.io");
const fs = require("fs");

const io = new Server({ cors: { origin: "http://localhost:3000" } });

// Object for storing online users in-memory
let onlineUserMap = {};

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
onlineUsers.forEach((user) => {
  onlineUserMap[user.userId] = user;
});

// Save online users periodically (every 1 minute)
setInterval(() => {
  const onlineUsersList = Object.values(onlineUserMap);
  saveOnlineUsers(onlineUsersList);
}, 60000); // Every minute

// Setting up socket.io server
io.on("connection", (socket) => {
  console.log("New connection aaa", socket.id);

  // Add a new user to the online users list
  socket.on("addNewUser", (user) => {
    console.log("User added:", user);

    if (onlineUserMap[user?._id]) return; // User already exists

    const newUser = {
      userId: user?._id,
      socketId: socket.id,
      role: user?.role,
    };

    // Add user to in-memory object
    onlineUserMap[user?._id] = newUser;
    
    // Emit updated list of online users
    io.emit("getOnlineUsers", Object.values(onlineUserMap));
    console.log("Updated online users:", Object.values(onlineUserMap));
  });

  // Handle incoming message
  socket.on("sendMessage", (message) => {
    console.log("Sending message:", message);

    const recipient = onlineUsers.find((user) => user.userId == message.receipientId);
    if (recipient) {
      console.log("Recipient found:", recipient);
      socket.to(recipient.socketId).emit("getMessage", message);
      socket.to(recipient.socketId).emit("getNotification", {
        senderId: message.senderId,
        isRead: false,
        date: new Date(),
        message: `${message?.senderName} sent you a message`,
      });
    } else {
      console.log("User not found in cache");
    }
  });

  // Handle incoming chat request
  socket.on("addNewRequest", (request) => {
    console.log("addNewRequest", request);

    // Send request to all non-"NORMAL" role users
    Object.values(onlineUserMap).forEach((user) => {
      if (user.role !== "NORMAL") {
        io.to(user.socketId).emit("getRequest", request);
        io.to(user.socketId).emit("getNotification", {
          senderId: request?.senderId?._id,
          isRead: false,
          message: `${request?.senderId?.name} requested for a chat`,
          date: new Date(),
        });
      }
    });
  });

  // Handle accepted request
  socket.on("requestAccepted", (chat) => {
    console.log("requestAccepted", chat);
    const user = onlineUserMap[chat.senderId];
    if (user) {
      io.to(user.socketId).emit("getAcceptRequest", chat);
    } else {
      console.log("User not found for senderId:", chat.senderId);
    }
  });

  // Handle chat closure
  socket.on("sendChatClosed", (chat) => {
    io.emit("getChatClosed", chat);
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    // Remove the user from the online users list
    Object.keys(onlineUserMap).forEach((userId) => {
      const user = onlineUserMap[userId];
      if (user?.socketId === socket.id) {
        delete onlineUserMap[userId];
      }
    });

    // Emit updated online users list
    io.emit("getOnlineUsers", Object.values(onlineUserMap));
    console.log("Updated online users after disconnect:", Object.values(onlineUserMap));
  });
});

// Start listening on port 4000
io.listen(4000, () => {
  console.log("Server listening on port 4000...");
});
