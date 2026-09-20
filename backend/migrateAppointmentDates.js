const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Appointment = require('./models/Appointment');

dotenv.config();

const getRelativeDate = (daysOffset) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const migrateAppointmentDates = async () => {
  try {
    await connectDB();

    const dateUpdates = [
      ['2024-05-20', getRelativeDate(0)],
      ['2024-05-18', getRelativeDate(-2)],
      ['2024-05-15', getRelativeDate(-5)],
      ['2024-05-22', getRelativeDate(2)],
      ['2024-05-25', getRelativeDate(5)],
      ['2026-09-19', getRelativeDate(0)],
      ['2026-09-17', getRelativeDate(-2)],
      ['2026-09-14', getRelativeDate(-5)],
      ['2026-09-21', getRelativeDate(2)],
      ['2026-09-24', getRelativeDate(5)],
    ];

    let updated = 0;
    for (const [oldDate, newDate] of dateUpdates) {
      const result = await Appointment.updateMany({ date: oldDate }, { $set: { date: newDate } });
      updated += result.modifiedCount;
      console.log(`${oldDate} -> ${newDate}: ${result.modifiedCount} appointment(s)`);
    }

    console.log(`Updated ${updated} appointment(s).`);
  } finally {
    await mongoose.connection.close();
  }
};

migrateAppointmentDates().catch((error) => {
  console.error('Appointment date migration failed:', error.message);
  process.exitCode = 1;
});
