const router = require("express").Router();

const authRoute = require("./auth");
const userRoute = require("./user");
const todoListRoute = require("./todoList");

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/todoList", todoListRoute);

module.exports = router;