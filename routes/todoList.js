const router = require("express").Router();

const todoListController = require("../controllers/todoListController");

router.post("/addTodo", todoListController.addTodo);
router.get("/todos", todoListController.getTodos);
router.get("/todos/:id", todoListController.getTodo);
router.put("/todos/:id", todoListController.updateTodo);
router.put("/todosDone/:id", todoListController.updateTodoDone);
router.delete("/todos/:id", todoListController.deleteTodo);

module.exports = router;
