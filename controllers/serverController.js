const session = require("express-session");
const RedisStore = require("connect-redis").default;
const redisClient = require("../utils/redis");

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: 'secret$%^134',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // sameSite : Chrome 计划将Lax变为默认设置。这时，
    // 网站可以选择显式关闭SameSite属性，将其设为None。
    // 不过，前提是必须同时设置Secure属性（Cookie 只能通过 HTTPS 协议发送），否则无效。
    // secure: true, 
    // sameSite:"none",
    path:'/',
      secure: false, // if true only transmit cookie over https
      httpOnly: false, // if true prevent client side JS from reading the cookie 
      maxAge: 1000 * 60 * 10 // session max age in miliseconds
  }
});

const wrap = expressMiddleware => (socket, next) =>
  expressMiddleware(socket.request, {}, next);


module.exports = { sessionMiddleware, wrap };