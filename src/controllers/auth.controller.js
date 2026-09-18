const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, Otp } = require('../../models');
const { sendOtpEmail } = require('../services/email.service');

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET || 'default_jwt_secret_key',
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '15m'
        }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user.id
        },
        process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key',
        {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
        }
    );
};

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username, email, and password'
            });
        }

        // Check existing username
        const existingUsername = await User.findOne({
            where: { username }
        });

        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: 'Username is already registered'
            });
        }

        // Check existing email
        const existingEmail = await User.findOne({
            where: { email }
        });

        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            role: 'user',
            isVerified: false
        });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('Register error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if ((!email && !username) || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email or username and password'
            });
        }

        // Build search conditions for email or username
        const conditions = [];
        if (email) conditions.push({ email });
        if (username) conditions.push({ username });

        // Find user
        const user = await User.findOne({
            where: {
                [Op.or]: conditions
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        // Generate JWT tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Save refresh token to user
        await user.update({ refreshToken });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    isVerified: user.isVerified
                }
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const refreshToken = async (req, res) => {
    try {
        const token = req.body.refreshToken || req.body.token;

        // Check refresh token
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            token,
            process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key'
        );

        // Find user
        const user = await User.findOne({
            where: {
                id: decoded.id,
                refreshToken: token
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // Update refresh token in database
        await user.update({ refreshToken: newRefreshToken });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    isVerified: user.isVerified
                }
            }
        });

    } catch (error) {

        console.error('Refresh token error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Refresh token has expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const logout = async (req, res) => {
    try {
        const token = req.body?.refreshToken || req.body?.token;
        const authHeader = req.headers.authorization;

        if (!token && (!authHeader || !authHeader.startsWith('Bearer '))) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token or authorization header is required'
            });
        }

        let user = null;

        // Try to identify user by refresh token in body
        if (token) {
            user = await User.findOne({
                where: { refreshToken: token }
            });
        }

        // Try to identify user by access token in Authorization header
        if (!user && authHeader && authHeader.startsWith('Bearer ')) {
            const accessToken = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(
                    accessToken,
                    process.env.JWT_SECRET || 'default_jwt_secret_key'
                );
                user = await User.findByPk(decoded.id);
            } catch (err) {
                if (!token) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid or expired token'
                    });
                }
            }
        }

        // Invalidate stored refresh token
        if (user) {
            await user.update({ refreshToken: null });
        }

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const sendOtp = async (req, res) => {
    try {
        const { email, type = 'verification' } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const normalizedEmail = email.toString().trim().toLowerCase();
        const normalizedType = type.toString().trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Expire in 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Ensure Otps table exists in DB
        await Otp.sync();

        // Invalidate any previous active OTPs for this email and type
        await Otp.update(
            { isUsed: true },
            {
                where: {
                    email: normalizedEmail,
                    type: normalizedType,
                    isUsed: false
                }
            }
        );

        // Save new OTP record
        await Otp.create({
            email: normalizedEmail,
            otp,
            expiresAt,
            isUsed: false,
            type: normalizedType
        });

        console.log(`\n========================================`);
        console.log(`[OTP SERVICE] Generated OTP for ${normalizedEmail}: ${otp}`);
        console.log(`Expires at: ${expiresAt.toISOString()}`);
        console.log(`========================================\n`);

        // Send email via nodemailer
        let emailResult = { delivered: false };
        try {
            emailResult = await sendOtpEmail(normalizedEmail, otp);
        } catch (emailErr) {
            console.error('[EMAIL SERVICE ERROR] Failed to send email:', emailErr.message);
        }

        return res.status(200).json({
            success: true,
            message: emailResult.delivered
                ? 'OTP sent successfully to your email'
                : 'OTP generated successfully',
            data: {
                email: normalizedEmail,
                expiresIn: '10 minutes',
                emailDelivered: emailResult.delivered,
                ...(process.env.NODE_ENV !== 'production' && { otp })
            }
        });

    } catch (error) {
        console.error('Send OTP error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { email, otp, type = 'verification' } = req.body;

        if (!email || otp === undefined || otp === null || otp === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and otp'
            });
        }

        const normalizedEmail = email.toString().trim().toLowerCase();
        const normalizedOtp = otp.toString().trim();
        const normalizedType = type.toString().trim().toLowerCase();

        // Ensure Otps table exists in DB
        await Otp.sync();

        // Find latest active OTP record for this email and type
        const otpRecord = await Otp.findOne({
            where: {
                email: normalizedEmail,
                type: normalizedType,
                isUsed: false
            },
            order: [['createdAt', 'DESC']]
        });

        if (!otpRecord) {
            // Check if there is any used/expired OTP for this email to give a helpful message
            const anyOtp = await Otp.findOne({
                where: {
                    email: normalizedEmail,
                    type: normalizedType
                },
                order: [['createdAt', 'DESC']]
            });

            if (anyOtp) {
                return res.status(400).json({
                    success: false,
                    message: 'This OTP has already been used or a newer OTP was requested. Please generate a new OTP.'
                });
            }

            return res.status(400).json({
                success: false,
                message: `No active OTP found for ${normalizedEmail}. Please request a new OTP first via /send-otp.`
            });
        }

        // Check if expired
        if (new Date() > new Date(otpRecord.expiresAt)) {
            await otpRecord.update({ isUsed: true });
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new OTP.'
            });
        }

        // Check matching OTP
        if (otpRecord.otp !== normalizedOtp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Mark OTP as used
        await otpRecord.update({ isUsed: true });

        // Update user isVerified status if user exists
        const user = await User.findOne({ where: { email: normalizedEmail } });
        if (user) {
            await user.update({ isVerified: true });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                email: normalizedEmail,
                isVerified: true,
                user: user
                    ? {
                          id: user.id,
                          username: user.username,
                          email: user.email,
                          role: user.role,
                          isVerified: true
                      }
                    : null
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    sendOtp,
    verifyOtp
};