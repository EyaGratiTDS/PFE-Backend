const sgMail = require('@sendgrid/mail');
require('dotenv').config(); 
const User = require('../models/User');
const ActivityLogController = require('../controllers/ActivityLogController');


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendVerificationEmail = async (email, name, verificationLink) => {
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM, 
    subject: 'Verify Your Email',
    html: `<div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Hello ${name},</h2>
        <p>Thank you for signing up on our site! Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationLink}" style="background-color: #06A3DA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>If you did not sign up for this account, you can safely ignore this email.</p>
        <p>Best regards,<br>The vCards Team</p>
      </div>`,
  };
  try {
    await sgMail.send(msg);

    console.log('Verification email sent');
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

const sendResetPasswordEmail = async (email, name, resetLink) => {
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM, 
    subject: 'Password Reset Request',
    html: `<div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Hello ${name},</h2>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <p><a href="${resetLink}" style="background-color: #06A3DA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The vCards Team</p>
      </div>`,
  };

  try {
    await sgMail.send(msg);
    console.log('Reset password email sent');
  } catch (error) {
    console.error('Error sending reset password email:', error);
    throw error;
  }
};

const sendWelcomeEmail = async (email, name) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email, 
      subject: 'Welcome to Our Website!', 
      text: `Hello ${name},\n\nWelcome to our website! We are thrilled to have you as part of our community.\n\nHere are a few things you can do to get started:\n- Explore our features\n- Update your profile\n- Contact our support team\n\nIf you have any questions or need assistance, feel free to reach out to our support team.\n\nBest regards,\nThe Support Team`, 
      html: `<p>Hello ${name},</p>
        <p>Welcome to our website! We are thrilled to have you as part of our community.</p>
        <p>Here are a few things you can do to get started:</p>
        <ul>
          <li>Explore our features</li>
          <li>Update your profile</li>
          <li>Contact our support team</li>
        </ul>
        <p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Support Team</p>
        <p><a href="https://yourwebsite.com" style="color: #06A3DA; text-decoration: none;">Visit Our Website</a></p>`, 
    };

    await sgMail.send(mailOptions);
    console.log('Welcome email sent successfully.');
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

const sendCustomEmail = async (email, name, { subject, text, html }) => {
  try {
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: subject,
      text: text,
      html: html || `<p>${text.replace(/\n\n/g, '</p><p>')}</p>`
    };

    await sgMail.send(msg);
    console.log(`Custom email sent to ${email}`);
  } catch (error) {
    console.error('Error sending custom email:', error);
    throw error;
  }
};

module.exports = { sendVerificationEmail, sendResetPasswordEmail, sendWelcomeEmail, sendCustomEmail };