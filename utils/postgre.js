const Pool = require("pg").Pool;
const postgrePool = new Pool({
  user: "postgres",
  password: process.env.DATABASE_PASSWORD,
  host: "localhost",
  port: 5432,
  database: "WebHomeManager"
});

module.exports = postgrePool;

// CREATE TABLE todoList(
//   todo_id SERIAL PRIMARY KEY,
//   description VARCHAR(255)
// );