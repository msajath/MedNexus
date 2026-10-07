const request = require('supertest');
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connection: { readyState: 0 },
}));
const mongoose = require('mongoose');
const { app } = require('../../server');

describe('Operational health endpoints', () => {
  test('liveness remains available without a database', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });

  test.each([[0, 503], [1, 200], [2, 503], [3, 503]])(
    'database state %i produces readiness status %i',
    async (state, status) => {
      const previous = mongoose.connection.readyState;
      mongoose.connection.readyState = state;
      try {
        const response = await request(app).get('/api/ready');
        expect(response.status).toBe(status);
      } finally {
        mongoose.connection.readyState = previous;
      }
    }
  );
});
