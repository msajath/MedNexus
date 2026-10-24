const request = require('supertest');
const express = require('express');
jest.mock('../../models/Doctor');
jest.mock('../../models/Payment');
jest.mock('../../models/Payout');
const Doctor = require('../../models/Doctor');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const { summarizePayouts, serializePayout, toMinor } = require('../../utils/payouts');
const app = express(); app.use(express.json());
app.use((req, res, next) => { req.user = { _id: 'admin' }; next(); });
app.use('/api/admin', require('../../routes/adminPayoutRoutes'));
const id = '507f1f77bcf86cd799439011';
const bank = { bankName: 'Sample Bank', accountNumber: '0000012345', accountHolderName: 'Sample Doctor' };
const payload = { doctorId: id, amount: 50, bankDetails: bank };
beforeEach(() => {
  jest.resetAllMocks();
  Doctor.findById.mockResolvedValue({ _id: id, user: id });
  Payment.find.mockResolvedValue([{ amountMinor: 10000, status: 'received' }]);
  Payout.find.mockResolvedValue([]);
  Payout.create.mockImplementation(async data => ({ _id: id, ...data }));
});
test('saving a salary request stays pending, masks bank data and ignores forged confirmation', async () => {
  const r = await request(app).post('/api/admin/payouts').send({ ...payload, status: 'completed', providerTransferId: 'forged' });
  expect(r.status).toBe(201);
  expect(r.body.payout).toMatchObject({ status: 'pending', amount: 50, bankDetails: { accountNumber: '****2345' } });
  expect(r.body.message).toMatch(/No money has been transferred/);
  expect(r.text).not.toContain(bank.accountNumber);
  expect(Payout.create.mock.calls[0][0]).not.toHaveProperty('providerTransferId');
});
test.each([0, -1, 0.001, '50', null, true, 1000001])('invalid payout money causes no writes: %p', async amount => {
  expect((await request(app).post('/api/admin/payouts').send({ ...payload, amount })).status).toBe(400);
  expect(Payout.create).not.toHaveBeenCalled();
});
test.each([{ bankName: 3 }, { accountNumber: '' }, { accountHolderName: '\u0000invalid' }])('invalid bank input causes no writes: %p', async invalid => {
  expect((await request(app).post('/api/admin/payouts').send({ ...payload, bankDetails: { ...bank, ...invalid } })).status).toBe(400);
  expect(Payout.create).not.toHaveBeenCalled();
});
test('missing doctor and insufficient unreserved earnings fail safely', async () => {
  Doctor.findById.mockResolvedValueOnce(null);
  expect((await request(app).post('/api/admin/payouts').send(payload)).status).toBe(404);
  Payout.find.mockResolvedValue([{ status: 'pending', amount: 70 }]);
  expect((await request(app).post('/api/admin/payouts').send(payload)).status).toBe(409);
  expect(Payout.create).not.toHaveBeenCalled();
});
test('unique-index conflicts reject competing payout requests', async () => {
  Payout.create.mockRejectedValue({ code: 11000 });
  expect((await request(app).post('/api/admin/payouts').send(payload)).status).toBe(409);
});
test('unexpected storage failures remain errors', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    Payout.create.mockRejectedValue(new Error('PRIVATE_STORAGE_FAILURE'));
    const r = await request(app).post('/api/admin/payouts').send(payload);
    expect(r.status).toBe(500); expect(r.text).not.toContain('PRIVATE_');
  } finally { log.mockRestore(); }
});
test('history validates filters and masks account numbers', async () => {
  expect((await request(app).get('/api/admin/payouts?doctorId=bad')).status).toBe(400);
  const chain = { populate: jest.fn().mockReturnThis(), sort: async () => [{ _id: id, status: 'pending', amount: 50, bankDetails: bank }] };
  Payout.find.mockReturnValue(chain);
  const r = await request(app).get(`/api/admin/payouts?doctorId=${id}`);
  expect(r.status).toBe(200); expect(r.body.transfersEnabled).toBe(false);
  expect(r.body.totalPaidOut).toBe(0); expect(r.body.reservedPayouts).toBe(50);
  expect(r.text).not.toContain(bank.accountNumber);
});
test('only pending payout requests may be cancelled', async () => {
  Payout.findOneAndUpdate.mockResolvedValueOnce({ _id: id, status: 'cancelled' }).mockResolvedValueOnce(null);
  expect((await request(app).post(`/api/admin/payouts/${id}/cancel`)).body.payout.status).toBe('cancelled');
  expect((await request(app).post(`/api/admin/payouts/${id}/cancel`)).status).toBe(409);
  expect(Payout.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: id, status: 'pending' });
});
test('only provider-confirmed transfers reduce paid balances; legacy claims stay unverified and reserved', () => {
  const items = [{ status: 'pending', amount: 10 }, { status: 'failed', amount: 999 }, { status: 'completed', amount: 20 },
    { status: 'completed', amount: 30, providerTransferId: 'provider-reference', providerConfirmedAt: new Date() }];
  expect(summarizePayouts(items)).toEqual({ totalPaidOut: 30, reservedPayouts: 30 });
  expect(serializePayout(items[2]).status).toBe('unverified');
  expect(toMinor(12.35)).toBe(1235);
});
