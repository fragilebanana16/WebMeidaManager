const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require('fs');
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./public/upload")
  },
  filename: function (req, file, cb) {
    return cb(null, `${Date.now()}_${file.originalname}`)
  }
})
const upload = multer({ storage })

process.on("uncaughtException", (err) => {
  console.log(err);
  console.log("UNCAUGHT Exception! Shutting down ...");
  process.exit(1); // Exit Code 1 indicates that a container shut down, either because of an application failure.
});

const app = require("./app");


const Busboy = require('busboy');
const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io"); // Add this
const { promisify } = require("util");
const getFileDetails = promisify(fs.stat);
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");
const { json } = require("body-parser");
const { InMemorySessionStore } = require("./utils/sessionStore");

const {  sessionMiddleware,  wrap,} = require("./controllers/serverController");
const { initializeUser, addFriend, parseRedisFriendList, disConnect } = require("./controllers/socketController");



const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    // useNewUrlParser: true, // The underlying MongoDB driver has deprecated their current connection string parser. Because this is a major change, they added the useNewUrlParser flag to allow users to fall back to the old parser if they find a bug in the new parser.
    // useCreateIndex: true, // Again previously MongoDB used an ensureIndex function call to ensure that Indexes exist and, if they didn't, to create one. This too was deprecated in favour of createIndex . the useCreateIndex option ensures that you are using the new function calls.
    // useFindAndModify: false, // findAndModify is deprecated. Use findOneAndUpdate, findOneAndReplace or findOneAndDelete instead.
    // useUnifiedTopology: true, // Set to true to opt in to using the MongoDB driver's new connection management engine. You should set this option to true , except for the unlikely case that it prevents you from maintaining a stable connection.
  })
  .then((con) => {
    console.log("DB Connection successful");
  });
// file upload
const uniqueAlphaNumericId = (() => {
  const heyStack = '0123456789abcdefghijklmnopqrstuvwxyz';
  const randomInt = () => Math.floor(Math.random() * Math.floor(heyStack.length));

  return (length = 24) => Array.from({ length }, () => heyStack[randomInt()]).join('');
})();

// target load path
const getFilePath = (fileName, fileId) => {
  return `./public/upload/file-${fileId}-${fileName}`
};

app.post('/upload-request', (req, res) => {
  console.log("File request..")

  if (!req.body || !req.body.fileName) {
    res.status(400).json({ message: 'Missing "fileName"' });
  } else {
    const fileId = uniqueAlphaNumericId();
    fs.createWriteStream(getFilePath(req.body.fileName, fileId), { flags: 'w' });
    res.status(200).json({ fileId });
  }
});

app.get('/upload-status', (req, res) => {
  console.log("File status..")

  if (req.query && req.query.fileName && req.query.fileId) {
    getFileDetails(getFilePath(req.query.fileName, req.query.fileId))
      .then((stats) => {
        res.status(200).json({ totalChunkUploaded: stats.size });
      })
      .catch(err => {
        console.error('failed to read file', err);
        res.status(400).json({ message: 'No file with such credentials', credentials: req.query });
      });
  }
});

app.post('/upload', (req, res) => {
  console.log("File upload..")

  const contentRange = req.headers['content-range'];
  const fileId = req.headers['x-file-id'];

  if (!contentRange) {
    console.log('Missing Content-Range');
    return res.status(400).json({ message: 'Missing "Content-Range" header' });
  }

  if (!fileId) {
    console.log('Missing File Id');
    return res.status(400).json({ message: 'Missing "X-File-Id" header' });
  }

  const match = contentRange.match(/bytes=(\d+)-(\d+)\/(\d+)/);

  if (!match) {
    console.log('Invalid Content-Range Format');
    return res.status(400).json({ message: 'Invalid "Content-Range" Format' });
  }

  const rangeStart = Number(match[1]);
  const rangeEnd = Number(match[2]);
  const fileSize = Number(match[3]);

  if (rangeStart >= fileSize || rangeStart >= rangeEnd || rangeEnd > fileSize) {
    return res.status(400).json({ message: 'Invalid "Content-Range" provided' });
  }

  const busboy = Busboy({ headers: req.headers });

  busboy.on('file', (_, file, fileName) => {
    console.log('file');
    // https://github.com/tulios/kafkajs/issues/1019 
    // https://github.com/mscdex/busboy/issues/20
    // https://github.com/expressjs/multer/issues/1104
    let decodedName = Buffer.from(fileName.filename, 'latin1').toString('utf8');
    const filePath = getFilePath(decodedName, fileId);
    if (!fileId) {
      req.pause();
    }

    getFileDetails(filePath)
      .then((stats) => {

        if (stats.size !== rangeStart) {
          return res
            .status(400)
            .json({ message: 'Bad "chunk" provided' });
        }

        file
          .pipe(fs.createWriteStream(filePath, { flags: 'a' }))
          .on('error', (e) => {
            console.error('failed upload', e);
            res.sendStatus(500);
          });
      })
      .catch(err => {
        console.log('No File Match', err);
        res.status(400).json({ message: 'No file with such credentials', credentials: req.query });
      })
  });

  busboy.on('error', (e) => {
    console.error('failed upload', e);
    res.sendStatus(500);
  })

  busboy.on('finish', () => {
    res.sendStatus(200);
  });

  req.pipe(busboy);
});
// file upload

// filepond use
app.post('/file/process', upload.single("inputName"), (req, res) => {
  console.log('form data', req.file);
  res.sendStatus(200);
})
// filepond use

app.get('/videos/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = "assets/movies/" + fileName;
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {

    // Parse Range
    // Example: "bytes=32324-"
    const CHUNK_SIZE = 10 ** 6; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, fileSize - 1);

    // const parts = range.replace(/bytes=/, '').split('-')
    // const start = parseInt(parts[0], 10);
    // const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    };
    res.writeHead(206, head);
    file.pipe(res);
  }
  else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res)
  }
})

const port = process.env.PORT || 8000;
server.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});

const crypto = require("crypto");
const randomId = () => crypto.randomBytes(8).toString("hex");

// const sessionStore = new InMemorySessionStore();

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling'],
    credentials: true
  },
});

io.use(wrap(sessionMiddleware));

io.on("connection", async (socket) => {
  initializeUser(socket);
  console.log(`A User connected, socket id is:${socket.id}`);
  console.log("==========[SOCKET]scoketio session user " + JSON.stringify(socket.request.session.user));

  // redisCliet.get('username', (error, username)=>{
  //   if (error) {
  //     console.log(error);
  //   }

  //   if (username != null) {
  //     console.log("redis hit:", username)
  //   }else{
  //     console.log("redis miss")
  //     redisCliet.setex('username', 10, socket.username);
  //   }
  // })

  // sessionStore.saveSession(socket.sessionID, {
  //   userID: socket.userID,
  //   username: socket.username,
  //   connected: true,
  // });

  const onlineUsers = [];
  for (let [id, socket] of io.of("/").sockets) {
    onlineUsers.push({
      userSocketId: id,
      userID: socket.handshake.query["user_id"],
    });
  }

  console.log("onlineUsers id:" + JSON.stringify(onlineUsers));
  // userController.onlineUsers = onlineUsers; // update server side
  // socket.emit("online_users_updated", onlineUsers); // tell client to fetch

  // console.log(JSON.stringify(socket.handshake.query));
  const user_id = socket.handshake.query["user_id"];

  socket.broadcast.emit("user_connected", {
    userSocketID: socket.id,
    userID: user_id,
  });

  socket.on("disconnecting", () => disConnect(socket));

  socket.on("disconnect", () => {
    socket.broadcast.emit("user_disconnected", user_id);
    
  });

  if (user_id != null && Boolean(user_id)) {
    try {
      await User.findByIdAndUpdate(user_id, {
        socket_id: socket.id,
        status: "Online",
      });
    } catch (e) {
      console.log("userconnect error:" + e);
    }
  }

  
  socket.on("typing", data => (
    socket.broadcast.emit("typingResponse", data)
  ))

  // We can write our socket event listeners in here...
  socket.on("friend_request", async (data, cb) => {
    console.log("friend_request data", JSON.stringify(data))
    // cb({errorMsg:"testSnack!"})
    addFriend(socket, data, cb);

    // const to = await User.findById(data.to).select("socket_id");
    // const from = await User.findById(data.from).select("socket_id");

    // // create a friend request
    // await FriendRequest.create({
    //   sender: data.from,
    //   recipient: data.to,
    // });
    // // emit event request received to recipient
    // io.to(to?.socket_id).emit("new_friend_request", {
    //   message: "New friend request received",
    // });
    // io.to(from?.socket_id).emit("request_sent", {
    //   message: "Request Sent successfully!",
    // });
  });

  socket.on("accept_request", async (data) => {
    // accept friend request => add ref of each other in friends array
    console.log("accept_request-" + data);
    const request_doc = await FriendRequest.findById(data.request_id);

    console.log("request_doc-" + request_doc);

    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recipient);

    sender.friends.push(request_doc.recipient);
    receiver.friends.push(request_doc.sender);

    await receiver.save({ new: true, validateModifiedOnly: true });
    await sender.save({ new: true, validateModifiedOnly: true });

    await FriendRequest.findByIdAndDelete(data.request_id);

    // delete this request doc
    // emit event to both of them

    // emit event request accepted to both
    io.to(sender?.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
    io.to(receiver?.socket_id).emit("request_accepted", {
      message: "Friend Request Accepted",
    });
  });

  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    console.log("server get_direct_conversations");

    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id] },
    }).populate("participants", "name avatar _id email status");

    // db.books.find({ authors: { $elemMatch: { name: "John Smith" } } })

    // console.log("existing_conversations-" + existing_conversations);

    callback(existing_conversations);
  });

  socket.on("get_online_users", async (callback) => {
    console.log("server get_online_users");
    callback(onlineUsers);
  });

  socket.on("get_friends", async (user_id, callback) => {
    var friends = await parseRedisFriendList(user_id);
    callback(friends);
  });

  socket.on("start_conversation", async (data) => {
    // data: {to: from:}

    const { to, from } = data;

    // check if there is any existing conversation

    const existing_conversations = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "name _id email status");

    console.log(existing_conversations[0], "Existing Conversation");

    // if no => create a new OneToOneMessage doc & emit event "start_chat" & send conversation details as payload
    if (existing_conversations.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });

      new_chat = await OneToOneMessage.findById(new_chat).populate(
        "participants",
        "name _id email status"
      );

      console.log(new_chat);

      socket.emit("start_chat", new_chat);
    }
    // if yes => just emit event "start_chat" & send conversation details as payload
    else {
      socket.emit("start_chat", existing_conversations[0]);
    }
  });

  socket.on("get_messages", async (data, callback) => {
    try {
      const msgs = await OneToOneMessage.findById(
        data.conversation_id
      ).select("messages");
      if(msgs){
        callback(msgs.messages);
      }
      else{
        console.log("get_messages msgs null")
      }
    } catch (error) {
      console.log(error);
    }
  });

  // Handle incoming text/link messages
  socket.on("text_message", async (data) => {
    console.log("Received message:", data);

    // data: {to, from, text}

    const { message, conversation_id, from, to, type } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);
    // console.log("----------------------------------");
    // console.log("to:" + to_user);
    // console.log("from:" + from_user);
    // console.log("----------------------------------");
    // console.log("Finding to:" + to);
    // console.log("Finding from:" + from);
    // message => {to, from, type, created_at, text, file}

    const new_message = {
      to: to,
      from: from,
      type: type,
      created_at: Date.now(),
      text: message,
    };

    // fetch OneToOneMessage Doc & push a new message to existing conversation
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages.push(new_message);
    // save to db`
    await chat.save({ new: true, validateModifiedOnly: true });

    // emit incoming_message -> to user

    console.log("Broadcast two sides to_user:" + to_user?.socket_id + ":" + message + "conversation_id:" + conversation_id);
    io.to(to_user?.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
    console.log("Broadcast two sides from_user:" + from_user?.socket_id + ":" + message + "conversation_id:" + conversation_id);
    // emit outgoing_message -> from user
    io.to(from_user?.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
  });

  // handle Media/Document Message
  socket.on("file_message", (data) => {
    console.log("Received message:", data);

    // data: {to, from, text, file}

    // Get the file extension
    const fileExtension = path.extname(data.file.name);

    // Generate a unique filename
    const filename = `${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtension}`;

    // upload file to AWS s3

    // create a new conversation if its dosent exists yet or add a new message to existing conversation

    // save to db

    // emit incoming_message -> to user

    // emit outgoing_message -> from user
  });



  // -------------- HANDLE SOCKET DISCONNECTION ----------------- //


  socket.on("end", async (data) => {
    // Find user by ID and set status as offline

    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    }

    // broadcast to all conversation rooms of this user that this user is offline (disconnected)

    console.log("closing connection");
    socket.disconnect(0);
  });
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  console.log("UNHANDLED REJECTION! Shutting down ...");
  server.close(() => {
    process.exit(1); //  Exit Code 1 indicates that a container shut down, either because of an application failure.
  });
});