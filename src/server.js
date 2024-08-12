// WriteSharp Server

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Configuration, OpenAIApi } = require("openai");
const rateLimit = require('express-rate-limit');

const app = express();

const DEBUG = process.env.NODE_ENV === 'development';

function log(message, ...args) {
    if (DEBUG) {
        console.log(`[WriteSharp] ${message}`, ...args);
    }
}

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
const MAX_TEXT_LENGTH = parseInt(process.env.MAX_TEXT_LENGTH) || 750;
log(`MAX_TEXT_LENGTH set to: ${MAX_TEXT_LENGTH}`);

/**
 * API endpoint for rephrasing text
 */
app.post('/api/rephrase', async (req, res) => {
  const { text, customPrompt } = req.body;
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

    const systemPrompt = `You are WriteSharp, an AI that enhances text clarity and professionalism. 
    Rephrase input text, maintaining original intent. Provide only the enhanced version.`;

    const defaultUserPrompt = `Improve the following text with these guidelines: 

    - Simplify complex sentences 
    - Use precise, professional language 
    - Ensure consistent tone and improved flow 
    - Correct grammar and punctuation 
    - Adapt to professional contexts 
    
    Input text:`;

    const userMessage = customPrompt
      ? `${customPrompt}\n\nInput text:\n\n${text}`
      : `${defaultUserPrompt}\n\n${text}`;

    const response = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 450,
      temperature: 0.7,
    });

    if (DEBUG) {
      log('OpenAI API request:', {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      });
    }

    const rephrasedText = response.data.choices[0].message.content.trim();
    res.json({ rephrasedText });
  } catch (error) {
    console.error('[WriteSharp] Error in /api/rephrase:', error);
    if (error.response) {
      console.error('[WriteSharp] OpenAI API responded with:', error.response.status, error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to rephrase text. Please try again.',
      details: error.message,
      stack: DEBUG ? error.stack : undefined
    });
  }
});

// Use environment variable for port
const PORT = parseInt(process.env.PORT) || 4000;
app.listen(PORT, () => log(`Server running on port ${PORT}`));

module.exports = app; // For testing purposes