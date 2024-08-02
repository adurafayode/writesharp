const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');

describe('/api/rephrase Endpoint', () => {
  it('should return rephrased text when valid text and API key are provided', async () => {
    const response = await request(app)
      .post('/api/rephrase')
      .set('x-api-key', 'your_openai_api_key_here')
      .send({ text: 'Hello, world!' });
    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('rephrasedText');
  });

  it('should return an error when text is not provided', async () => {
    const response = await request(app)
      .post('/api/rephrase')
      .set('x-api-key', 'your_openai_api_key_here')
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
      .set('x-api-key', 'your_openai_api_key_here')
      .send({ text: longText });
    expect(response.status).to.equal(400);
    expect(response.body).to.have.property('error', `Text exceeds maximum length of ${process.env.MAX_TEXT_LENGTH} characters.`);
  });
});

describe('Rate Limiting Middleware', () => {
  function createServerWithRateLimit() {
    const express = require('express');
    const rateLimit = require('express-rate-limit');
    const app = express();

    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 2, // 2 requests per minute
      message: 'Too many requests, please try again later.',
    });

    app.use(limiter);
    app.get('/', (req, res) => res.send('Hello, world!'));
    return app;
  }

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
