const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const { summarizePayments, serializePayment } = require('../utils/payments');

test('actual receipt summaries use integer cents and deduct audited refunds', () => {
  expect(summarizePayments([
    { amountMinor: 10010, status: 'received' }, { amountMinor: 2020, status: 'received' },
    { amountMinor: 5005, status: 'refunded' },
  ])).toEqual({ receivedAmount: 170.35, refundedAmount: 50.05, netReceived: 120.3, receivedPayments: 2, currency: 'USD', basis: 'recorded_payments' });
  expect(summarizePayments([])).toMatchObject({ receivedAmount: 0, refundedAmount: 0, netReceived: 0, receivedPayments: 0 });
});

test('receipt serializer omits every field outside the operational audit allowlist', () => {
  const payment = serializePayment({ _id: 'receipt', appointment: 'booking', doctor: 'doctor', patient: 'patient', amountMinor: 10099, currency: 'USD', method: 'cash', status: 'received', receivedAt: 'received', recordedAt: 'recorded', recordedBy: 'admin', cardNumber: 'secret', notes: 'secret', symptoms: 'secret' });
  expect(payment).toMatchObject({ id: 'receipt', appointmentId: 'booking', doctorId: 'doctor', patientId: 'patient', amount: 100.99 });
  expect(JSON.stringify(payment)).not.toContain('secret');
});

test.each([0, -1, 1.5, 100000001])('payment model refuses non-integer, non-positive or excessive cents: %p', (amountMinor) => {
  const id = new mongoose.Types.ObjectId();
  const payment = new Payment({ appointment: id, doctor: id, patient: id, recordedBy: id, amountMinor, method: 'cash', currency: 'USD', receivedAt: new Date() });
  expect(payment.validateSync().errors.amountMinor).toBeDefined();
});
