const express = require('express');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: false }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Clinic data
const CLINIC = {
  name: 'Jakarta Aesthetic Clinic',
  treatments: [
    { id: 1, name: 'Basic Brightening Facial', price: 500000, duration: 60 },
    { id: 2, name: 'Advanced Vitamin C', price: 850000, duration: 90 },
    { id: 3, name: 'Medical Grade Treatment', price: 1200000, duration: 120 },
  ],
};

// Simple conversation state (in-memory)
const conversations = {};

function getResponse(phoneNumber, message) {
  if (!conversations[phoneNumber]) {
    conversations[phoneNumber] = { stage: 'start' };
  }

  const state = conversations[phoneNumber];
  const msg = message.toLowerCase().trim();

  // Stage 1: Initial greeting
  if (state.stage === 'start') {
    state.stage = 'treatment_choice';
    return `Hi! 👋 Welcome to ${CLINIC.name}.\n\nWhat treatment are you interested in?\n\n${CLINIC.treatments
      .map((t) => `${t.id}. ${t.name} - ${t.price.toLocaleString()} IDR (${t.duration}min)`)
      .join('\n')}`;
  }

  // Stage 2: Treatment selected
  if (state.stage === 'treatment_choice') {
    const treatmentId = parseInt(msg);
    const selected = CLINIC.treatments.find((t) => t.id === treatmentId);

    if (selected) {
      state.stage = 'slot_choice';
      state.selectedTreatment = selected;
      return `Great! You chose ${selected.name}.\n\nAvailable slots:\n1. Dec 13 - 10:00 AM\n2. Dec 13 - 2:00 PM\n3. Dec 14 - 10:00 AM\n4. Dec 14 - 3:00 PM\n5. Dec 15 - 11:00 AM\n\nWhich slot? (reply with 1-5)`;
    }
    return `Sorry, please reply with 1, 2, or 3.`;
  }

  // Stage 3: Appointment confirmed
  if (state.stage === 'slot_choice') {
    const slotId = parseInt(msg);
    if (slotId >= 1 && slotId <= 5) {
      const slots = ['Dec 13 - 10:00 AM', 'Dec 13 - 2:00 PM', 'Dec 14 - 10:00 AM', 'Dec 14 - 3:00 PM', 'Dec 15 - 11:00 AM'];
      const selectedSlot = slots[slotId - 1];
      state.stage = 'completed';

      return `✓ BOOKING CONFIRMED!\n\n📋 Treatment: ${state.selectedTreatment.name}\n⏰ When: ${selectedSlot}\n📍 Where: ${CLINIC.name}\n💰 Cost: ${state.selectedTreatment.price.toLocaleString()} IDR\n\nYou'll get reminders 24hr before.\nPayment at clinic.\nSee you soon! 😊`;
    }
    return `Sorry, please reply with 1, 2, 3, 4, or 5.`;
  }

  return `How can I help you?`;
}

// Webhook: Receive WhatsApp messages
app.post('/whatsapp', async (req, res) => {
  const incomingMessage = req.body.Body;
  const senderNumber = req.body.From;

  console.log(`📱 Message from ${senderNumber}: ${incomingMessage}`);

  // Generate response
  const response = getResponse(senderNumber, incomingMessage);

  // Send response back
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
      to: senderNumber,
      body: response,
    });
    console.log(`✅ Sent response`);
  } catch (error) {
    console.error('Error sending message:', error);
  }

  res.status(200).send('OK');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/whatsapp`);
});