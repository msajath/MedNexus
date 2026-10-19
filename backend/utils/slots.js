const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultSchedule = [
  { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
  { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
  { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
  { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
];
const isValidDate = (date) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date;
};
const timeToMinutes = (time) => {
  if (typeof time !== 'string') return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match || +match[1] < 1 || +match[1] > 12 || +match[2] > 59) return null;
  return (+match[1] % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + +match[2];
};
const minutesToTime = (minutes) => `${String(Math.floor(minutes / 60) % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${minutes >= 720 ? 'PM' : 'AM'}`;
const normalizeTime = (time) => timeToMinutes(time) === null ? time : minutesToTime(timeToMinutes(time));
const clinicClock = () => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: process.env.CLINIC_TIME_ZONE || 'Asia/Colombo', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
const clinicDate = () => { const p = clinicClock(); return `${p.year}-${p.month}-${p.day}`; };
const isFutureSlot = (date, time) => {
  const p = clinicClock();
  return isValidDate(date) && timeToMinutes(time) !== null &&
    (date > `${p.year}-${p.month}-${p.day}` || (date === `${p.year}-${p.month}-${p.day}` && timeToMinutes(time) > +p.hour * 60 + +p.minute));
};
const scheduleMinutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const isWithinSchedule = (date, time, schedule) => {
  if (!isValidDate(date)) return false;
  const dayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (dayIndex === 0 || dayIndex === 6) return false;
  const item = schedule.find((s) => s.day === dayNames[dayIndex]);
  const minutes = timeToMinutes(time);
  return !!item?.enabled && minutes !== null && minutes >= scheduleMinutes(item.start) &&
    minutes + 30 <= scheduleMinutes(item.end) && minutes % 30 === 0;
};
const allowedTransitions = { pending: ['confirmed', 'cancelled'], confirmed: ['completed', 'cancelled'], cancelled: [], completed: [] };
module.exports = { defaultSchedule, isValidDate, timeToMinutes, minutesToTime, normalizeTime, clinicDate, isFutureSlot, isWithinSchedule, allowedTransitions };
