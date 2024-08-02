require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Configuration, OpenAIApi } = require("openai");
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN
}));
app.use(helmet());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.RATE_LIMIT, // requests per minute
  message: 'Too many requests, please try again later.',
});

// Apply rate limiting to all requests
app.use(limiter);

// API endpoint
app.post('/api/rephrase', async (req, res) => {
  const { text } = req.body;
  const apiKey = req.headers['x-api-key'];

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  if (text.length > process.env.MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `Text exceeds maximum length of ${process.env.MAX_TEXT_LENGTH} characters.` });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    const configuration = new Configuration({ apiKey });
    const openai = new OpenAIApi(configuration);

    const response = await openai.createCompletion({
      model: "gpt-3.5-turbo", // Change the model to gpt-3.5-turbo or gpt-4
      prompt: `Rephrase the following text to improve clarity and professionalism:\n\n${text}\n\nRephrased version:`,
      max_tokens: 300, // Adjusted max_tokens
      temperature: 0.7,
    });

    const rephrasedText = response.data.choices[0].text.trim();
    res.json({ rephrasedText });
  } catch (error) {
    console.error('Error in /api/rephrase:', error);
    res.status(500).json({ error: 'Failed to rephrase text. Please check your API key and try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; // For testing purposes
