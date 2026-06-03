// Resend Email Service
// Handles sending emails for forgot password and account notifications

const { Resend } = require('resend');

// Initialize Resend with API key from .env
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── SEND EMAIL ───────────────────────────────────────────────────────────

async function sendEmail(to, subject, html) {
  try {
    const result = await resend.emails.send({
      from:    'EcoCycle <onboarding@resend.dev>', 
      to:      [to],
      subject: subject,
      html:    html,
    });

    console.log('Email sent successfully:', result);
    return { success: true, result };

  } catch (err) {
    console.error('Email failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── FORGOT PASSWORD EMAIL ────────────────────────────────────────────────

async function sendForgotPasswordEmail(to, resetToken) {
  const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">EcoCycle</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p style="color: #666;">
          We received a request to reset your EcoCycle account password.
          Click the button below to reset it.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #2E7D32; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-size: 16px;">
            Reset Password
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">
          This link expires in 1 hour. If you didn't request a password reset, 
          please ignore this email.
        </p>
      </div>
      <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
        © 2026 EcoCycle. All rights reserved.
      </div>
    </div>
  `;

  return sendEmail(to, 'Reset Your EcoCycle Password', html);
}

// ─── ACCOUNT APPROVED EMAIL ───────────────────────────────────────────────

async function sendAccountApprovedEmail(to, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">EcoCycle</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #333;">Account Approved! 🎉</h2>
        <p style="color: #666;">Hi ${name},</p>
        <p style="color: #666;">
          Your EcoCycle account has been approved by an administrator.
          You can now log in and start using the platform.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:3000/login.html" 
             style="background-color: #2E7D32; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-size: 16px;">
            Login Now
          </a>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
        © 2026 EcoCycle. All rights reserved.
      </div>
    </div>
  `;

  return sendEmail(to, 'Your EcoCycle Account Has Been Approved', html);
}

// ─── WELCOME EMAIL ────────────────────────────────────────────────────────

async function sendWelcomeEmail(to, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2E7D32; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">EcoCycle</h1>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9;">
        <h2 style="color: #333;">Welcome to EcoCycle! 🌿</h2>
        <p style="color: #666;">Hi ${name},</p>
        <p style="color: #666;">
          Thank you for creating an EcoCycle account. 
          Your account is currently being reviewed by an administrator.
          You will receive another email once it is approved.
        </p>
      </div>
      <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
        © 2026 EcoCycle. All rights reserved.
      </div>
    </div>
  `;

  return sendEmail(to, 'Welcome to EcoCycle!', html);
}

module.exports = {
  sendEmail,
  sendForgotPasswordEmail,
  sendAccountApprovedEmail,
  sendWelcomeEmail,
};