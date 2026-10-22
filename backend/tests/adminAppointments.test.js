const { serializeAdminAppointment, summarizeAppointments } = require('../utils/adminAppointments');

test('administrative appointment payloads use an allowlist at every nested level', () => {
  const result = serializeAdminAppointment({
    _id: 'appointment', patient: { _id: 'patient', name: 'Patient', email: 'patient@example.test', bloodType: 'private' },
    doctor: { _id: 'doctor', specialty: 'General', user: { _id: 'doctor-user', name: 'Doctor', password: 'private' }, licenseNumber: 'private' },
    status: 'confirmed', date: '2030-01-01', time: '10:00 AM', type: 'Consultation', feeAtBooking: 125,
    notes: 'private', symptoms: 'private', bookingHold: { token: 'private' }, rescheduleIntent: { token: 'private' },
    rescheduleHistory: [{ fromDate: '2030-01-01', fromTime: '09:00 AM', toDate: '2030-01-01', toTime: '10:00 AM', changedAt: 'now', changedBy: 'private', notes: 'private' }],
  });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(result).not.toHaveProperty('notes');
  expect(result).not.toHaveProperty('symptoms');
  expect(result.rescheduled).toBe(true);
  expect(result.feeAtBooking).toBe(125);
  expect(result.rescheduleHistory[0]).toEqual({ fromDate: '2030-01-01', fromTime: '09:00 AM', toDate: '2030-01-01', toTime: '10:00 AM', changedAt: 'now' });
});

test('summary counts reschedules as history, not a mutually exclusive status', () => {
  const summary = summarizeAppointments([
    { status: 'pending' }, { status: 'confirmed', feeAtBooking: 100 },
    { status: 'completed', feeAtBooking: 125, rescheduleHistory: [{}] },
    { status: 'completed', feeAtBooking: 0 }, { status: 'completed' },
    { status: 'cancelled', feeAtBooking: 200, rescheduleHistory: [{}] },
  ]);
  expect(summary.appointmentSummary).toEqual({ total: 6, pending: 1, confirmed: 1, completed: 3, cancelled: 1, rescheduled: 2 });
  expect(summary).not.toHaveProperty('earnings');
});

test('empty appointment summaries contain numeric zero values', () => {
  expect(summarizeAppointments([]).appointmentSummary).toEqual({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, rescheduled: 0 });
});

test.each([undefined, null, -1, NaN, Infinity, '125'])('unknown or invalid historical fees are not represented as booked prices: %p', (feeAtBooking) => {
  expect(summarizeAppointments([{ status: 'completed', feeAtBooking }])).not.toHaveProperty('earnings');
  expect(serializeAdminAppointment({ _id: 'a', feeAtBooking }).feeAtBooking).toBeNull();
});
