const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439011', role: 'patient' };
    next();
  },
}));
jest.mock('../../models/Message');

const Message = require('../../models/Message');
const messageRoutes = require('../../routes/messageRoutes');

const app = express();
app.use(express.json());
app.use('/api/messages', messageRoutes);

describe('Message Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the current user messages', async () => {
    Message.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    const res = await request(app).get('/api/messages');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, count: 0, messages: [] });
    expect(Message.find).toHaveBeenCalledWith({ recipient: '507f1f77bcf86cd799439011' });
  });

  it('rejects an invalid message id', async () => {
    const res = await request(app).put('/api/messages/not-an-id/read');

    expect(res.statusCode).toBe(400);
    expect(Message.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
