const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const rateLimit = require('express-rate-limit');
const app = require('../src/server'); // Assuming this is your main app file

function createServerWithRateLimit() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Rate limiting middleware
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 2, // Limit each IP to 2 requests per windowMs for testing
    message: 'Too many requests, please try again later.',
  });

  // Apply rate limiting to all requests
  app.use(limiter);

  // Define a simple route for testing
  app.get('/', (req, res) => {
    res.status(200).send('OK');
  });

  return app;
}

describe('/api/rephrase Endpoint', () => {
  it('should return rephrased text when valid text and API key are provided', async () => {
    const response = await request(app)
      .post('/api/rephrase')
      .set('x-api-key', 'sk-rwyawMO_TOWurz2UEBJwVch-XA3vuP2VwRoPRkv5CAT3BlbkFJEtlW2GgCRr8y1-FW0z_9rhofWFJ4EsXSZdHLa5K1MA') // Replace with your actual API key
      .send({ text: 'Hello, world!' });
    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('rephrasedText');
  });

  it('should return an error when text is not provided', async () => {
    const response = await request(app)
      .post('/api/rephrase')
      .set('x-api-key', 'sk-rwyawMO_TOWurz2UEBJwVch-XA3vuP2VwRoPRkv5CAT3BlbkFJEtlW2GgCRr8y1-FW0z_9rhofWFJ4EsXSZdHLa5K1MA') // Replace with your actual API key
      .send({});
    expect(response.status).to.equal(400);
    expect(response.body).to.have.property('error', 'Text is required');
  });

  it('should return an error when API key is not provided', async () => {
    const response = await request(app)
      .post('/api/rephrase')
      .send({ text: 'Hello, world!' });
    expect(response.status).to.equal(400);
    expect(response.body).to.have.property('error', 'API key is required');
  });

  it('should return an error when text exceeds maximum length', async () => {
    const longText = 'a'.repeat(parseInt(process.env.MAX_TEXT_LENGTH) + 1);
    const response = await request(app)
      .post('/api/rephrase')
      .set('x-api-key', 'sk-rwyawMO_TOWurz2UEBJwVch-XA3vuP2VwRoPRkv5CAT3BlbkFJEtlW2GgCRr8y1-FW0z_9rhofWFJ4EsXSZdHLa5K1MA') // Replace with your actual API key
      .send({ text: longText });
    expect(response.status).to.equal(400);
    expect(response.body).to.have.property('error', `Text exceeds maximum length of ${process.env.MAX_TEXT_LENGTH} characters.`);
  });
});

describe('Rate Limiting Middleware', () => {
  it('should allow up to the maximum number of requests', async () => {
    const app = createServerWithRateLimit();
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
  });

  it('should block requests exceeding the limit', async () => {
    const app = createServerWithRateLimit();
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(429);
  });
});
