jest.mock('../models/Payment');
const Payment = require('../models/Payment');
const { creditCompletedAppointment } = require('../utils/appointmentEarnings');
const appointment = { _id: '507f1f77bcf86cd799439011', doctor: 'doctor', patient: 'patient', feeAtBooking: 125.25 };
beforeEach(() => jest.resetAllMocks());
test.each([0, null, undefined, -1, NaN, '125'])('does not invent earnings for an absent, free or invalid booked fee: %p', async feeAtBooking => {
  await creditCompletedAppointment({ ...appointment, feeAtBooking }, 'actor');
  expect(Payment.create).not.toHaveBeenCalled();
});
test('credits the immutable booked fee with a full appointment reference', async () => {
  Payment.findOne.mockResolvedValue(null);
  await creditCompletedAppointment(appointment, 'actor');
  expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 12525, method: 'auto_credit', reference: `AUTO-${appointment._id}`, recordedBy: 'actor' }));
});
test.each(['received', 'refunded'])('completion retry never duplicates or resurrects a %s credit', async status => {
  Payment.findOne.mockResolvedValue({ status });
  await creditCompletedAppointment(appointment, 'actor');
  expect(Payment.create).not.toHaveBeenCalled();
});
test('a racing unique-index conflict is accepted only when its original credit exists', async () => {
  Payment.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'received' });
  Payment.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
  await expect(creditCompletedAppointment(appointment, 'actor')).resolves.toBeUndefined();
});
test('storage errors propagate so completion cannot report a successful credit', async () => {
  Payment.findOne.mockResolvedValue(null);
  Payment.create.mockRejectedValue(new Error('credit storage unavailable'));
  await expect(creditCompletedAppointment(appointment, 'actor')).rejects.toThrow('credit storage unavailable');
});
test('fees outside the supported integer money range fail', async () => {
  await expect(creditCompletedAppointment({ ...appointment, feeAtBooking: 1000001 }, 'actor')).rejects.toThrow('Invalid booked');
});
