const request = require('supertest');
const express = require('express');
const contactRoutes = require('../../routes/contactRoutes');
const ContactMessage = require('../../models/ContactMessage');

jest.mock('../../models/ContactMessage');

const app = express();
app.use(express.json());
app.use('/api/contact', contactRoutes);

describe('Contact Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid contact submission', async () => {
    const res = await request(app).post('/api/contact').send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(ContactMessage.create).not.toHaveBeenCalled();
  });

  it('stores a valid contact submission', async () => {
    ContactMessage.create.mockResolvedValue({ _id: 'contact-1' });

    const res = await request(app).post('/api/contact').send({
      name: 'QA User',
      email: 'qa@example.com',
      subject: 'Test question',
      message: 'This is a valid contact form message.',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(ContactMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'qa@example.com',
      subject: 'Test question',
    }));
  });
});
