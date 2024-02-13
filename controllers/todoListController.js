const catchAsync = require("../utils/catchAsync");
const postgrePool = require("../utils/postgre.js");

exports.addTodo = catchAsync(async (req, res, next) => {
  try {
    console.log("todo here")
    const { title, description } = req.body;
    const newTodo = await postgrePool.query(
      "INSERT INTO todolist (title, description, done, createdTime) VALUES($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *",
      [title, description, false]
    );

    res.json(newTodo.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

exports.getTodos = catchAsync(async (req, res, next) => {
  try {
    const allTodos = await postgrePool.query("SELECT * FROM todolist");
    res.json(allTodos.rows);
  } catch (err) {
    console.error(err.message);
  }
});

exports.getTodo = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const todo = await postgrePool.query("SELECT * FROM todolist WHERE todo_id = $1", [
      id
    ]);

    res.json(todo.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

exports.updateTodo = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const updateTodo = await postgrePool.query(
      "UPDATE todolist SET description = $1, title = $2 WHERE todo_id = $3",
      [description, title, id]
    );

    res.json("Todo was updated!");
  } catch (err) {
    console.error(err.message);
  }
});

exports.updateTodoDone = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { done } = req.body;
    const updateTodo = await postgrePool.query(
      "UPDATE todolist SET done = $1, finishedTime = "+ (done ? "NOW()" : "null") + " WHERE todo_id = $2",
      [done, id]
    );

    res.json("Todo done was updated!");
  } catch (err) {
    console.error(err.message);
  }
});

exports.deleteTodo = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteTodo = await postgrePool.query("DELETE FROM todolist WHERE todo_id = $1", [
      id
    ]);
    res.json("Todo was deleted!");
  } catch (err) {
    console.log(err.message);
  }
});