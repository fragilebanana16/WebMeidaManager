const redisClient = require("../utils/redis");

module.exports.authorizeUser = (socket, next) => {
  if (!socket.request.session || !socket.request.session.user) {
    console.log("[SOCKET]Socket session error!");
    next(new Error("Not authorized"));
  } else {
    console.log("[SOCKET]Socket authorized.");
    socket.user = { ...socket.request.session.user };
    redisClient.hset(
      `userid:${socket.user.username}`,
      "userid", // key
      socket.user.userid // value
    );
    next();
  }
};