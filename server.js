const express = require('express');
const twilio = require('twilio');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: false }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

async function getAIResponse(phoneNumber, message) {
  if (!conversations[phoneNumber]) {
    conversations[phoneNumber] = { history: [] };
  }

  const state = conversations[phoneNumber];
  
  // Build conversation history
  state.history.push({ role: 'user', content: message });

  const systemPrompt = `You are a helpful assistant for ${CLINIC.name}. 
Available treatments:
${CLINIC.treatments.map(t => `- ${t.name}: ${t.price.toLocaleString()} IDR (${t.duration} min)`).join('\n')}

Available slots:
- Dec 13: 10:00 AM, 2:00 PM
- Dec 14: 10:00 AM, 3:00 PM
- Dec 15: 11:00 AM

Help customers book appointments. Be friendly and professional.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        ...state.history
      ]
    });

    const aiResponse = completion.choices[0].message.content;
    state.history.push({ role: 'assistant', content: aiResponse });

    return aiResponse;
  } catch (error) {
    console.error('OpenAI Error:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

// Webhook: Receive WhatsApp messages
app.post('/whatsapp', async (req, res) => {
  const incomingMessage = req.body.Body;
  const senderNumber = req.body.From;
  console.log(`📱 Message from ${senderNumber}: ${incomingMessage}`);

  // Generate AI response
  const response = await getAIResponse(senderNumber, incomingMessage);

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
