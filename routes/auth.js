const router = require("express").Router();

const authController = require("../controllers/authController");

// chainable route handlers
router.route("/trylogin").post(authController.handleTryLogin);
router.route("/login").post(authController.login);

router.post("/register", authController.register);
// router.post("/verify", authController.verifyOTP);
// router.post("/send-otp", authController.sendOTP);

router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/test", authController.test);

module.exports = router;
