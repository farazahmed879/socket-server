const { Server } = require("socket.io");

const io = new Server({ cors: "http://localhost:3000" });

let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("mysconnection", socket.id);
  console.log("onlineUsers", onlineUsers);
  socket.on("addNewUser", (user) => {
    console.log("addNewUser", user);
    if (onlineUsers.some((u) => u?.userId == user?._id)) return;
    onlineUsers.push({
      userId: user?._id,
      socketId: socket.id,
      role: user?.role,
    });
    console.log("onlineUsers aaa", onlineUsers);

    // console.log("onlineUsers", onlineUsers);
    io.emit("getOnlneUsers", onlineUsers);
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
        message: `${message?.senderName} sent you a message`,
      });
    }
  });

  socket.on("addNewRequest", (request) => {
    io.emit("getRequest", request);
    io.emit("getNotification", {
      senderId: request?.senderId?._id,
      isRead: false,
      message: `${request?.senderId?.name} requested for a chat`,
      date: new Date(),
    });
  });

  socket.on("requestAccepted", (chat) => {
    const user = onlineUsers.find((i) => i.userId === chat.senderId);
    if (user) io.to(user.socketId).emit("getAcceptRequest", chat);
  });

  socket.on("sendChatClosed", (chat) => {
    io.emit("getChatClosed", chat);
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((i) => i.socketId != socket.id);
    io.emit("getOnlneUsers", onlineUsers);
  });
});

io.listen(4000);
