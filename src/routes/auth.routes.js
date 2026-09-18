const express = require('express');

const {
    register,
    login,
    refreshToken,
    logout,
    sendOtp,
    verifyOtp
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', register);

router.post('/login', login);

router.post('/refresh-token', refreshToken);

router.post('/logout', logout);

router.post('/send-otp', sendOtp);

router.post('/verify-otp', verifyOtp);

module.exports = router;