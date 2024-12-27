const { Server } = require("socket.io");

const io = new Server({ cors: "http://localhost:3000" });

let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("mysconnection", socket.id);

  socket.on("addNewUser", (userId) => {
    console.log("addNewUser", onlineUsers, userId);

    if (onlineUsers.some((user) => user?.userId == userId)) return;
    console.log("barha");
    onlineUsers.push({
      userId,
      socketId: socket.id,
    });

    // console.log("onlineUsers", onlineUsers);
    socket.emit("getOnlneUsers", onlineUsers);
  });

  //add message
  socket.on("sendMessage", (message) => {
    const user = onlineUsers.find((i) => i.userId === message.receipientId);

    if (user) {
      io.to(user.socketId).emit("getMessage", message);
      io.to(user.socketId).emit("getNotification", {
        senderId: message.senderId,
        isRead: false,
        date: new Date(),
      });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((i) => i.socketId != socket.id);
    socket.emit("getOnlneUsers", onlineUsers);
  });
});

io.listen(4000);
