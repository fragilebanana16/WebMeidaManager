const catchAsync = require("../utils/catchAsync");
const postgrePool = require("../utils/postgre.js");

exports.addTodo = catchAsync(async (req, res, next) => {
  try {
    console.log("todo here")
    const { description } = req.body;
    const newTodo = await postgrePool.query(
      "INSERT INTO todolist (description) VALUES($1) RETURNING *",
      [description]
    );

    res.json(newTodo.rows[0]);
  } catch (err) {
    console.error(err.message);
  }
});

exports.getTodos = catchAsync(async (req, res, next) => {
  try {
    const allTodos = await postgrePool.query("SELECT * FROM todo");
    res.json(allTodos.rows);
  } catch (err) {
    console.error(err.message);
  }
});

exports.getTodo = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const todo = await postgrePool.query("SELECT * FROM todo WHERE todo_id = $1", [
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
    const { description } = req.body;
    const updateTodo = await postgrePool.query(
      "UPDATE todo SET description = $1 WHERE todo_id = $2",
      [description, id]
    );

    res.json("Todo was updated!");
  } catch (err) {
    console.error(err.message);
  }
});

exports.deleteTodo = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteTodo = await postgrePool.query("DELETE FROM todo WHERE todo_id = $1", [
      id
    ]);
    res.json("Todo was deleted!");
  } catch (err) {
    console.log(err.message);
  }
});