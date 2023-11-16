const redisClient = require("../utils/redis");

module.exports.authorizeUser = (socket, next) => {
  if (!socket.request.session || !socket.request.session.user) {
    console.log("[SOCKET]Socket session error!");
    next();
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

module.exports.addFriend = async (socket, data, cb) => {
  if (data.to === socket.user.userid) {
    cb({errorMsg: "[SOCKET]Cannot add self!" });
    return;
  }
  const friendUserID = await redisClient.hget(
    `userid:${friendName}`,
    "userid"
  );
  const currentFriendList = await redisClient.lrange(
    `friends:${socket.user.username}`,
    0,
    -1
  );
  if (!friendUserID) {
    cb({ done: false, errorMsg: "User doesn't exist!" });
    return;
  }
  if (currentFriendList && currentFriendList.indexOf(friendName) !== -1) {
    cb({ done: false, errorMsg: "Friend already added!" });
    return;
  }

  await redisClient.lpush(`friends:${socket.user.username}`, friendName);
  cb({ done: true });
};