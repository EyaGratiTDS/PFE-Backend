const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { sendResetPasswordEmail } = require("../services/emailService");
const ActivityLogController = require('../controllers/ActivityLogController');
const notificationController = require('../controllers/NotificationController');
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require('../database/db');

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'We don\'t recognize that email.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 heure

    await db.execute(
      'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?',
      [resetToken, new Date(resetTokenExpiry), user.id]
    );

    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
    await sendResetPasswordEmail(user.email, user.name, resetLink);

    res.status(200).json();
  } catch (error) {
    console.error('Error during forgot password process:', error);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});
  
  router.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
  
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }
  
    try {
      const [rows] = await db.promise().execute(
        "SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?",
        [token, new Date()]
      );
  
      if (rows.length === 0) {
        return res.status(400).json({ message: "Invalid or expired token." });
      }
  
      const user = new User(rows[0]);
  
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
  
      await db.promise().execute(
        "UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?",
        [hashedPassword, user.id]
      );
      try {
        await notificationController.sendPasswordChangeNotification(user.id);
      } catch (notificationError) {
        console.error('Failed to send password change notification:', notificationError);
      }
      await ActivityLogController.logActivity(user.id, 'password_reset_success', req);
      res.status(200).json({ message: "Your password has been reset successfully." });
    } catch (error) {
      await activityLogController.logActivity(user.id, 'password_reset_failed', req);
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });
  
  module.exports = router;