require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Configuration, OpenAIApi } = require("openai");
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(express.json());
app.use(helmet());

// Updated CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Origin', 'Accept'],
  credentials: true
}));

// Add a preflight route handler
app.options('*', cors());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT) || 60, // requests per minute
  message: 'Too many requests, please try again later.',
});

// Apply rate limiting to all requests
app.use(limiter);

// Ensure MAX_TEXT_LENGTH is set
const MAX_TEXT_LENGTH = parseInt(process.env.MAX_TEXT_LENGTH) || 500;
console.log(`MAX_TEXT_LENGTH set to: ${MAX_TEXT_LENGTH}`);

// API endpoint
app.post('/api/rephrase', async (req, res) => {
  const { text } = req.body;
  const apiKey = req.headers['x-api-key'];

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters.` });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);

    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: `Rephrase the following text to improve clarity and professionalism:\n\n${text}` }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const rephrasedText = response.data.choices[0].message.content.trim();
    res.json({ rephrasedText });
  } catch (error) {
    console.error('Error in /api/rephrase:', error);
    if (error.response) {
      console.error('OpenAI API responded with:', error.response.status, error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to rephrase text. Please try again.',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Use environment variable for port
const PORT = parseInt(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; // For testing purposes