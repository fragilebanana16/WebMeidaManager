const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const mailService = require("../services/mailer");
const crypto = require("crypto");
const filterObj = require("../utils/filterObj");

// Model
const User = require("../models/user");
const otp = require("../Templates/Mail/otp");
const resetPassword = require("../Templates/Mail/resetPassword");
const { promisify } = require("util");
const catchAsync = require("../utils/catchAsync");
const { json } = require("body-parser");

// this function will return you jwt token
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);



// Register New User
exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  const filteredBody = filterObj(
    req.body,
    "name",
    "email",
    "password"
  );

  // check if a verified user with given email exists

  const existing_user = await User.findOne({ email: email });

  if (existing_user) {
    // user with this email already exists, Please login
    return res.status(400).json({
      status: "error",
      message: "Email already in use, Please login.",
    });
  } else{
    const new_user = await User.create(filteredBody);
    return res.status(200).json({
      status: "ok",
      message: new_user.email + " Register Ok.",
    });
  } 
});

exports.handleLogin = async (req, res, next) => {
  console.log("handleLogin", req.session)
  req.session.user = "dwadwad"
  // req.session.save();
  if (req.session.user && req.session.user.name) {
    res.json({
      status: "success",
      message: "Using Session - Logged in successfully!",
      token: req.session.user.token,
      user_id: req.session.user.userid,
    });
  } else {
  console.log("Failed to log in with session, try db acsess..")
  next();
//[TODO]session still does not have username etc. after login with db
    // res.json({
    //   status: "error",
    //   message: "Using Session Failed Log in...",
    // });
  }
};

// User Login
exports.login = catchAsync(async (req, res, next) => {


  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
    return;
  }

  const user = await User.findOne({ email: email }).select("+password");

  if (!user || !user.password) {
    res.status(400).json({
      status: "error",
      message: "Incorrect password",
    });

    return;
  }

  if (!user || !(await user.correctPassword(password, user.password))) {
    res.status(400).json({
      status: "error",
      message: "Email or password is incorrect",
    });

    return;
  }

  const token = signToken(user._id);
  // console.log(user);
  req.session.user = {
    username: user.name,
    userid: user._id,
    token: token,
  };

  // req.session.save();
  console.log("session after login:", req.session)
  res.status(200).json({
    status: "success",
    message: "Logged in successfully!",
    token,
    user_id: user._id,
  });
});

// Protect
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      message: "You are not logged in! Please log in to get access.",
    });
  }
  // 2) Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  console.log("decoded token:" + JSON.stringify(decoded));

  // 3) Check if user still exists

  const this_user = await User.findById(decoded.userId);
  if (!this_user) {
    return res.status(401).json({
      message: "The user belonging to this token does no longer exists.",
    });
  }
  // 4) Check if user changed password after the token was issued, iat: create time stamp
  if (this_user.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      message: "User recently changed password! Please log in again.",
    });
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = this_user;
  next();
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "There is no user with email address.",
    });
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    // const resetURL = `http://localhost:3000/auth/new-password?token=${resetToken}`;
    // TODO => Send Email with this Reset URL to user's email address
    // console.log(resetURL);
    // mailService.sendEmail({
    //   from: "shreyanshshah242@gmail.com",
    //   to: user.email,
    //   subject: "Reset Password",
    //   html: resetPassword(user.firstName, resetURL),
    //   attachments: [],
    // });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
      resetToken: `${resetToken}`
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      message: "There was an error sending the email. Try again later!",
    });
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  // const hashedToken = crypto
  //   .createHash("sha256")
  //   .update(req.body.resetToken)
  //   .digest("hex");

  const user = await User.findOne({
    // passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return res.status(400).json({
      status: "error",
      message: "Token is Invalid or Expired",
    });
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  // user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    message: "Password Reseted Successfully",
    token,
  });
});
