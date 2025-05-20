const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Op } = require('sequelize');
const User = require('../models/User');
const userController = require('../controllers/userController');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  passReqToCallback: true,
  scope: ['profile', 'email'],
  prompt: 'consent'
},
async (req, accessToken, refreshToken, profile, done) => {
  try {    
    if (!profile.emails || !profile.emails[0]) {
      throw new Error('No email provided by Google');
    }

    const authResult = await userController.handleGoogleAuth(req, req.res, profile);
    if (!authResult.success) {
      return done(new Error(authResult.message), null);
    }
    return done(null,  {
      token: authResult.token,
      user: authResult.user
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, {
    id: user.user?.id,
    email: user.user?.email,
    role: user.user?.role
  });
});

passport.deserializeUser(async (userData, done) => {
  try {
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { id: userData.id },
          { email: userData.email }
        ]
      },
      attributes: { exclude: ['password'] }
    });
    
    done(null, user || null);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;