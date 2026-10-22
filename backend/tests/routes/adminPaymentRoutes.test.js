const request = require('supertest');
const express = require('express');

jest.mock('../../models/Appointment');
jest.mock('../../models/Payment');
const Appointment = require('../../models/Appointment');
const Payment = require('../../models/Payment');

const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { _id: '507f1f77bcf86cd799439099', role: 'admin' }; next(); });
app.use('/api/admin', require('../../routes/adminPaymentRoutes'));

test('database failure during duplicate-receipt recovery returns a safe HTTP error', async () => {
  const id = '507f1f77bcf86cd799439011';
  Appointment.findOne.mockReturnValue({ select: async () => ({ _id: id, doctor: id, patient: id, status: 'confirmed' }) });
  Payment.findOne.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('PRIVATE_DATABASE_CONNECTION_ERROR'));
  Payment.create.mockRejectedValueOnce(Object.assign(new Error('Duplicate'), { code: 11000 }));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await request(app).post(`/api/admin/appointments/${id}/payment`).set('Idempotency-Key', 'retry-recovery-1').send({ amount: 100, currency: 'USD', method: 'cash' });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ success: false, message: 'Internal Server Error' });
    expect(response.text).not.toContain('PRIVATE_');
    expect(Payment.findOne).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('Request failed:', 'Error');
  } finally { log.mockRestore(); }
});
