import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up old notifications once per day
crons.interval(
  "delete old notifications",
  { hours: 24 },
  internal.notifications.deleteOld,
  { days: 30 },
);

export default crons;
