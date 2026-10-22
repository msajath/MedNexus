// Administrative views deliberately omit symptoms, consultation notes and records.
const adminAppointmentFilter = { bookingHold: { $exists: false } };
const adminAppointmentSelection = '_id patient doctor date time type status feeAtBooking createdAt updatedAt rescheduleHistory';

const idOf = (value) => value == null ? null : String(value._id || value);
const person = (value) => {
  if (!value || !value.name) return value ? { _id: idOf(value) } : null;
  return { _id: idOf(value), name: value.name, email: value.email, phone: value.phone, avatar: value.avatar };
};
const validFee = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const serializeAdminAppointment = (appointment) => {
  const history = (appointment.rescheduleHistory || []).map((entry) => ({
    fromDate: entry.fromDate, fromTime: entry.fromTime,
    toDate: entry.toDate, toTime: entry.toTime, changedAt: entry.changedAt,
  }));
  const doctor = appointment.doctor || appointment.populated?.('doctor');
  const patient = appointment.patient || appointment.populated?.('patient');
  return {
    _id: idOf(appointment),
    patient: person(patient),
    doctor: doctor ? { _id: idOf(doctor), specialty: doctor.specialty, user: person(doctor.user) } : null,
    date: appointment.date, time: appointment.time, type: appointment.type, status: appointment.status,
    feeAtBooking: validFee(appointment.feeAtBooking) ? appointment.feeAtBooking : null,
    createdAt: appointment.createdAt, updatedAt: appointment.updatedAt,
    rescheduled: history.length > 0, rescheduleHistory: history,
  };
};

const summarizeAppointments = (appointments) => {
  const appointmentSummary = { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, rescheduled: 0 };
  for (const appointment of appointments) {
    appointmentSummary.total += 1;
    if (Object.hasOwn(appointmentSummary, appointment.status) && !['total', 'rescheduled'].includes(appointment.status)) {
      appointmentSummary[appointment.status] += 1;
    }
    if (appointment.rescheduleHistory?.length) appointmentSummary.rescheduled += 1;
  }
  return { appointmentSummary };
};

module.exports = { adminAppointmentFilter, adminAppointmentSelection, serializeAdminAppointment, summarizeAppointments, validFee };
