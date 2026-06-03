// Africa's Talking SMS Service
// Handles sending SMS notifications to pickers

const AfricasTalking = require('africastalking');

// Initialize Africa's Talking with credentials from .env
const africastalking = AfricasTalking({
  apiKey:   process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

// Get the SMS service
const sms = africastalking.SMS;

// ─── SEND SMS ─────────────────────────────────────────────────────────────

async function sendSMS(phoneNumber, message) {
  try {
    const result = await sms.send({
      to:      [phoneNumber],
      message: message,
    });

    console.log('SMS sent successfully:', result);
    return { success: true, result };

  } catch (err) {
    console.error('SMS failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── TRANSACTION SMS ──────────────────────────────────────────────────────

async function sendTransactionSMS(pickerName, pickerPhone, material, quantity, total) {
  const message = `Hi ${pickerName}! Your collection has been recorded: ${quantity}kg of ${material}. Total payout: R${total}. Thank you for keeping our environment clean! - EcoCycle`;
  return sendSMS(pickerPhone, message);
}

// ─── REGISTRATION SMS ─────────────────────────────────────────────────────

async function sendRegistrationSMS(pickerName, pickerPhone, pickerId) {
  const message = `Welcome to EcoCycle, ${pickerName}! Your picker ID is ${pickerId}. Start collecting and earning today! - EcoCycle Team`;
  return sendSMS(pickerPhone, message);
}

module.exports = {
  sendSMS,
  sendTransactionSMS,
  sendRegistrationSMS,
};