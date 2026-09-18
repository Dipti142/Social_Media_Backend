const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using environment credentials
const createTransporter = () => {
    const isConfigured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

    if (!isConfigured) {
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Send OTP Email
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6 digit OTP
 */
const sendOtpEmail = async (toEmail, otp) => {
    const transporter = createTransporter();

    if (!transporter) {
        console.warn(`\n[EMAIL SERVICE WARNING] EMAIL_USER or EMAIL_PASS not set in .env!`);
        console.warn(`Email not delivered to ${toEmail}. Set EMAIL_USER & EMAIL_PASS in .env to deliver actual emails.\n`);
        return {
            delivered: false,
            message: 'Email credentials not configured in .env'
        };
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
            .content { padding: 30px; text-align: center; color: #334155; }
            .content p { font-size: 16px; line-height: 1.6; margin-bottom: 25px; }
            .otp-box { display: inline-block; background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 10px; padding: 15px 35px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; margin: 10px 0 25px; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Social Media Verification</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>Your one-time password (OTP) for account verification is:</p>
                <div class="otp-box">${otp}</div>
                <p style="color: #64748b; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
            </div>
            <div class="footer">
                If you did not request this OTP, please ignore this email.
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: process.env.EMAIL_FROM || `"Social Media App" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Your Verification Code: ${otp}`,
        text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
        html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] OTP successfully delivered to ${toEmail} (MessageId: ${info.messageId})`);

    return {
        delivered: true,
        messageId: info.messageId
    };
};

module.exports = {
    sendOtpEmail
};
