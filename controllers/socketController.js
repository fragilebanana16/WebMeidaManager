const redisClient = require("../utils/redis");

module.exports.authorizeUser = (socket, next) => {
  var user_id = "";
  var user_name = "";
  if (socket.request.session && socket.request.session.user) {
    socket.user = { ...socket.request.session.user };
    user_id = socket.user.userid;
    user_name = socket.user.username;
  }
  else if (socket.handshake && socket.handshake.query) {
    console.log("[SOCKET]Socket session empty! Using socket handshake query params...");
    user_id = socket.handshake.query["user_id"];
    user_name = socket.handshake.query["user_name"];
    console.log("socket.handshake.query:", socket.handshake.query)
  }

  redisClient.hmset(
    `userid:${user_id}`,
    "userid", // key
    user_id, // value
    "username",
    user_name,
  );

  console.log("[SOCKET]Socket Redis authorized.");
  next();
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