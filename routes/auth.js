const router = require("express").Router();

const authController = require("../controllers/authController");

// chainable route handlers
router.route("/login").post(authController.handleLogin).post(authController.login);

router.post("/register", authController.register);
// router.post("/verify", authController.verifyOTP);
// router.post("/send-otp", authController.sendOTP);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;
