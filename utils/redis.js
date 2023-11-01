const Redis = require("ioredis")
const redisCliet = Redis.createClient();

module.exports = redisCliet;