const redisClient = require("../utils/redis");
const User = require("../models/user");
const { crossOriginResourcePolicy } = require("helmet");
const OneToOneMessage = require("../models/OneToOneMessage");
const parseDBFriendList = async friends => {
  const friendList = [];
  for (let friend of friends) {
    const friendStatus= await redisClient.hget(
      `userid:${friend._id}`,
      "userstatus"
    );

    friendList.push({
      userid: friend._id,
      username: friend.name,
      userstatus: friendStatus,
    });
  }
  return friendList;
};


module.exports.parseRedisFriendList = async (user_id) => {
  const friendList = await redisClient.lrange(    `friends:${user_id}`,    0,    -1  );
  const newFriendList = [];
  for (let friend of friendList) {
    const parsedFriend = friend.split(".");
    const friendStatus= await redisClient.hget(
      `userid:${parsedFriend[1]}`,
      "userstatus"
    );

    newFriendList.push({
      username: parsedFriend[0],
      userid: parsedFriend[1],
      userstatus: friendStatus,
    });
  }
  return newFriendList;
}

module.exports.disConnect =  async socket => {
  console.log(socket.handshake.query["user_name"] + " disconnected...")
  var userid = socket.handshake.query["user_id"];
  await redisClient.hset(
    `userid:${userid}`,
    "userstatus",
    "IsOffline"
  );

  // inform this user is disconnected
  socket.broadcast.emit("user_disconnected", userid);
  
  // const friendList = await redisClient.lrange(
  //   `friends:${socket.user.username}`,
  //   0,
  //   -1
  // );
  // const friendRooms = await parseFriendList(friendList).then(friends =>
  //   friends.map(friend => friend.userid)
  // );
  // socket.to(friendRooms).emit("connected", false, socket.user.username);
};

module.exports.initializeUser = async (socket) => {
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

  // register current connect user to redis
  await redisClient.hmset(
    `userid:${user_id}`,
    "userid", // key
    user_id, // value
    "username",
    user_name,
    "userstatus",
    "IsOnline", // IsAway, IsOnline, IsOffline, IsBusy
    "socketId",
     socket.id
  );

  // 1.find user friends in db
  const this_user = await User.findById(user_id).populate(
    "friends",
    "_id name"
  );

  // 2.store in redis
  const dbParsedFriends = await parseDBFriendList(this_user.friends)
  const formattedFriendsInfo = dbParsedFriends.map(f => [f.username, f.userid].join("."));
  await redisClient.del(`friends:${user_id}`);
  await redisClient.lpush(
    `friends:${user_id}`,
    ...formattedFriendsInfo
  );

  const friendRooms = dbParsedFriends.map(friend => friend.userid);
  if (friendRooms.length > 0)
  {
    socket.to(friendRooms).emit("user_connected", "IsOnline", user_name, user_id);
    console.log("[SOCKET]user_connected send to rooms.");
  }

  // 1.find conversation from db
  const existing_conversations = await OneToOneMessage.find({
    participants: { $all: [user_id] },
  }).populate("participants", "name avatar _id email status");

  // console.log(existing_conversations[0].participants.map(p => p.id).join("."));

  // 2.store in redis
  for (let conversation of existing_conversations) {
    let participantsStr = conversation.participants.map(p => p.id).join(".");

    let conversationRedisKey = `conversation:${conversation._id}=>${participantsStr}`;
    let keyExist = await redisClient.exists(`${conversationRedisKey}`);
    if(keyExist === 1)
    {
      console.log(`==================================${conversationRedisKey} exists`);
      continue;
    }

    await redisClient.del(`${conversationRedisKey}`);
    await redisClient.hset(`${conversationRedisKey}`, "conversation", JSON.stringify(conversation)); // use json.parse to see the object
  }

  console.log("[SOCKET]Socket Redis authorized.");
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