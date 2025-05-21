const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require("multer");
const path = require("path");
const fs = require('fs');
const { sendVerificationEmail } = require('../services/emailService');
const axios = require('axios');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const activityLogController = require('../controllers/ActivityLogController');
const notificationController = require('../controllers/NotificationController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const deleteFileIfExists = (filePath) => {
  if (!filePath) return;
  
  const normalizedPath = filePath.startsWith('/uploads/') 
    ? filePath.substring(9) 
    : filePath;
  
  const absolutePath = path.join(__dirname, '../uploads', normalizedPath);
  
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
      console.log(`Fichier supprimé: ${absolutePath}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier ${absolutePath}:`, error);
    }
  }
};


  const signUp = async (req, res) => {
    try {
      const { name, email, password, recaptchaToken } = req.body;

      const recaptchaResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
      );

      if (!recaptchaResponse.data.success) {
        return res.status(400).json({ 
          success: false,
          message: 'reCAPTCHA validation failed.' 
        });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          message: 'A user with this email already exists.' 
        });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');

      const user = await User.create({
        name,
        email,
        password,
        role:"admin",
        verificationToken
      });

      const verificationLink = `${process.env.BACKEND_URL}/users/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(email, name, verificationLink);
      const createdUser = await getUserByEmail(email);
      await notificationController.sendWelcomeNotification(createdUser.id, name);
      await activityLogController.logActivity(createdUser.id, 'register_success', req);

      return res.status(201).json({ 
        success: true,
        message: 'User registered successfully. Please check your email.' 
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  };

  const verifyEmail = async (req, res) => {
    try {
      const { token } = req.query;
      const user = await User.findOne({ where: { verificationToken: token } });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      user.isVerified = true;
      user.verificationToken = null;
      await user.save();

      res.redirect(`${process.env.FRONTEND_URL}/sign-in?verified=true`);
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Email verification failed' });
    }
  };

  const signIn = async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;
      const user = await User.findOne({ where: { email } });
  
      if (!user) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid email or password' 
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid email or password' 
        });
      }
      if (!user.isVerified) {
        return res.status(403).json({ 
          success: false,
          message: 'Please verify your email address to activate your account.' 
        });
      }
      let requires2FA = false;
      let tempToken;

      if (user.twoFactorEnabled) {
         tempToken = jwt.sign(
          { id: user.id, needs2FA: true },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );
        requires2FA= true;
        
      }
  
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: rememberMe ? '7d' : '24h' }
      );
  
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
        sameSite: 'strict'
      });

      await activityLogController.logActivity(user.id, 'login_success', req);
      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role 
        },
        requires2FA,
        tempToken
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to log in. Please try again.' 
      });
    }
  };

  const updateUser = async (req, res) => {
    try {
        const id = req.user.id;
        
        const { 
            name, 
            email,  
        } = req.body;

        const avatar = req.file;
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        const userData = {
            name: name || user.name,
            email: email || user.email,
        };

        if (avatar) {
            userData.avatar = `/uploads/${avatar.filename}`;
            
            if (user.avatar) {
                deleteFileIfExists(user.avatar);
            }
        }

        const [updated] = await User.update(userData, {
            where: { id },
        });

        if (updated) {
            const updatedUser = await User.findByPk(id);
            await activityLogController.logActivity(user.id, 'update_profile', req);
            res.json({
                success: true,
                data: updatedUser
            });
        } else {
            res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    
    await activityLogController.logActivity(userId, 'logout', req);

    res.clearCookie('jwt', { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });

    res.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('[Logout] Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getUserByEmail = (email) => {
  try {
    if (!email) {
      throw new Error('Email is required');
    }
    
    const user = User.findOne({ where: { email } });
    return user;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};


  const handleGoogleAuth =  async (req, res, profile) => {  
    try {
      if (!profile.emails || !profile.emails.length) {
        throw new Error('No email provided by Google');
      }
  
      const email = profile.emails[0].value;
      let user = await User.findOne({ where: { email } });
      
      if (!user) {
        user = await User.create({
          name: profile.displayName || 'Utilisateur Google',
          email,
          isVerified: true,
          role: 'admin',  
          password: crypto.randomBytes(16).toString('hex') 
        });
        const createdUser = await getUserByEmail(email);
        await notificationController.sendWelcomeNotification(createdUser.id, createdUser.name);
      }
  
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
  
      if (res) {
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
          sameSite: 'strict'
        });
      }
      await activityLogController.logActivity(user.id, 'login_success_with_google', req);
      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified
        }
      };
  
    } catch (error) {
      await activityLogController.logActivity(user.id, 'login_failed_with_google', req);
      console.error('Google auth error:', {
        message: error.message,
        stack: error.stack,
        profile: profile ? profile.emails : null
      });
      
      return {
        success: false,
        message: 'Google authentication failed',
        error: error.message
      };
    }
  };
  const getCurrentUser = async (req, res) => {
    try {
      const user = req.user;

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user information'
      });
    }
  };
  const changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findByPk(req.user.id);
  
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }
      
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password'
        });
      }

      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          success: false,
          message: 'Current password is incorrect' 
        });
      }
  
      user.password = newPassword;
      await user.save();
      await activityLogController.logActivity(user.id, 'password_changed_success', req);
      res.json({ 
        success: true,
        message: 'Password changed successfully' 
      });
    } catch (error) {
      await activityLogController.logActivity(user.id, 'password_changed_failed', req);
      console.error('Change password error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to change password' 
      });
    }
  };
  
  const generateTwoFactorSecret = async (req, res) => {
    try {
      const userId = req.user.id;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      const secret = speakeasy.generateSecret({
        length: 20,
        name: `MyApp:${user.email}`,
        issuer: 'MyApp'
      });
  
      user.twoFactorSecret = secret.base32;
      
      await user.save();
      
      const updatedUser = await User.findByPk(userId);
      
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
  
      return res.json({
        success: true,
        data: {
          secret: secret.base32,
          qrCode: qrCodeUrl
        }
      });
    } catch (error) {
      console.error('Generate 2FA secret error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate 2FA secret',
        error: error.message
      });
    }
  };
  
  const getTwoFactorStatus = async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      return res.json({
        success: true,
        data: {
          enabled: user.twoFactorEnabled
        }
      });
    } catch (error) {
      console.error('Get 2FA status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get 2FA status'
      });
    }
  };
  
  const verifyAndEnableTwoFactor = async (req, res) => {
    try {
      const { token } = req.body;
      const user = await User.findByPk(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      if (!user.twoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: '2FA secret not found. Please generate a new secret first.'
        });
      }
  
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 1
      });
  
      console.log('Verification result:', verified);
  
      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }
  
      const recoveryCodes = Array(5).fill().map(() => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
  
      user.twoFactorEnabled = true;
      user.twoFactorRecoveryCodes = recoveryCodes.join(',');
      await user.save();
      await notificationController.sendTwoFactorEnabledNotification(user.id);
      await activityLogController.logActivity(user.id, 'two_factor_enabled', req);
      return res.json({
        success: true,
        data: {
          recoveryCodes
        }
      });
    } catch (error) {
      console.error('Verify 2FA error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify 2FA code',
        error: error.message 
      });
    }
  };
  const disableTwoFactor = async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      if (!user.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: '2FA is not enabled'
        });
      }
  
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorRecoveryCodes = null;
      await user.save();
      await notificationController.sendTwoFactorDisabledNotification(user.id);
      await activityLogController.logActivity(user.id, 'two_factor_disabled', req);
      res.json({
        success: true,
        message: '2FA disabled successfully'
      });
    } catch (error) {
      console.error('Disable 2FA error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disable 2FA'
      });
    }
  };
  
  const deleteAccount = async (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ 
          success: false,
          message: 'Password is required' 
        });
      }

      const user = await User.findByPk(req.user.id);
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
  
      if (user.avatar) {
        deleteFileIfExists(user.avatar);
      }
  
      await user.destroy();
  
      res.clearCookie('authToken');
      
      res.json({ 
        success: true,
        message: 'Account deleted successfully' 
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to delete account' 
      });
    }
};

const verifyTwoFactorLogin = async (req, res) => {
  try {
    const { token, tempToken } = req.body;
    
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

    if (!decoded.needs2FA) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      const recoveryCodes = user.twoFactorRecoveryCodes ? user.twoFactorRecoveryCodes.split(',') : [];
      const recoveryIndex = recoveryCodes.indexOf(token);
      
      if (recoveryIndex === -1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }
      
      recoveryCodes.splice(recoveryIndex, 1);
      user.twoFactorRecoveryCodes = recoveryCodes.join(',');
      await user.save();
    }

    const finalToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('authToken', finalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });

    res.json({
      success: true,
      token: finalToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify 2FA login error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
};
  module.exports = {
    signIn,
    signUp,
    logout,
    getCurrentUser,
    updateUser,
    handleGoogleAuth,
    changePassword,
    generateTwoFactorSecret,
    verifyAndEnableTwoFactor,
    getTwoFactorStatus,
    disableTwoFactor,
    verifyTwoFactorLogin,
    deleteAccount,
    verifyEmail,
    upload
  };