const redisClient = require("../utils/redis");

module.exports.authorizeUser = (socket, next) => {
  if (!socket.request.session || !socket.request.session.user) {
    console.log("[SOCKET]Socket session error!");
    next();
  } else {
    console.log("[SOCKET]Socket authorized.");
    socket.user = { ...socket.request.session.user };
    redisClient.hmset(
      `userid:${socket.user.userid}`,
      "userid", // key
      socket.user.userid, // value
      "username",
      socket.user.username,
    );
    next();
  }
};

module.exports.addFriend = async (socket, data, cb) => {
  if(!socket.user || !socket.user.userid){
    cb({ errorMsg: "Login and try agian! Cause socket data is not initialized..", severity:"error" });
    return;
  }

  if (data.to === socket.user.userid) {
    cb({ errorMsg: "Cannot add self!", severity:"error" });
    return;
  }

  const friendUserID = await redisClient.hget(`userid:${data.to}`, "userid");
  const currentFriendList = await redisClient.lrange(`friends:${socket.user.userid}`, 0, -1);
  if (!friendUserID) {
    cb({ done: false, errorMsg: `Your friend doesn't exist in redis!`, severity:"error" });
    return;
  }
  if (currentFriendList && currentFriendList.indexOf(data.to) !== -1) {
    cb({ done: false, errorMsg: "Friend already added!", severity:"info" });
    return;
  }

  await redisClient.lpush(`friends:${socket.user.userid}`, data.to);
  cb({ done: true, errorMsg: `Add friend ok from Redis!`, severity:"success" });
};