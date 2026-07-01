import { describe, expect, test } from "vitest";
import { buildDoctorWeekSections } from "./doctorAppointmentWeeks";

describe("buildDoctorWeekSections", () => {
  test("builds the Algerian Sunday-to-Saturday week from backend boundaries", () => {
    const sections = buildDoctorWeekSections({
      startDate: "2099-01-04",
      endDate: "2099-01-10",
      days: [
        {
          date: "2099-01-04",
          appointments: [
            {
              appointmentDate: "2099-01-04",
              appointmentTime: "09:00",
            },
          ],
        },
        {
          date: "2099-01-05",
          appointments: [
            {
              appointmentDate: "2099-01-05",
              appointmentTime: "10:00",
            },
          ],
        },
      ],
      mapAppointment: (appointment) => appointment,
      sortAppointments: (appointments) =>
        [...appointments].sort((a, b) =>
          a.appointmentTime.localeCompare(b.appointmentTime),
        ),
    });

    expect(sections.map((section) => section.date)).toEqual([
      "2099-01-04",
      "2099-01-05",
      "2099-01-06",
      "2099-01-07",
      "2099-01-08",
      "2099-01-09",
      "2099-01-10",
    ]);
    expect(sections[0]).toMatchObject({
      dayName: "الأحد",
      title: "الأحد 4 جانفي",
      data: [{ appointmentDate: "2099-01-04", appointmentTime: "09:00" }],
    });
    expect(sections[1]).toMatchObject({
      dayName: "الإثنين",
      title: "الإثنين 5 جانفي",
      data: [{ appointmentDate: "2099-01-05", appointmentTime: "10:00" }],
    });
    expect(sections[2].data).toEqual([]);
  });
});
