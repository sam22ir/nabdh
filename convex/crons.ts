import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily(
  'doctor daily summaries',
  {
    hourUTC: 6,
    minuteUTC: 0,
  },
  internal.notifications.sendDailySummaries,
  {},
);

crons.interval(
  'clinic appointment attendance automation',
  { minutes: 1 },
  internal.bookings.processAutomaticAttendance,
  {},
);

export default crons;
