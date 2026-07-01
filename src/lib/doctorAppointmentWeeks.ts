const ARABIC_DAYS: readonly string[] = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const ARABIC_MONTHS: readonly string[] = [
  "جانفي",
  "فيفري",
  "مارس",
  "أفريل",
  "ماي",
  "جوان",
  "جويلية",
  "أوت",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

type BackendWeekDay<TBackendAppointment> = {
  date: string;
  appointments: TBackendAppointment[];
};

type BuildDoctorWeekSectionsArgs<TBackendAppointment, TAppointment> = {
  startDate: string;
  endDate: string;
  days: BackendWeekDay<TBackendAppointment>[];
  mapAppointment: (appointment: TBackendAppointment) => TAppointment;
  sortAppointments: (appointments: TAppointment[]) => TAppointment[];
};

export type DoctorWeekSection<TAppointment> = {
  title: string;
  date: string;
  dayName: string;
  data: TAppointment[];
};

function parseDateOnly(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDoctorWeekSections<TBackendAppointment, TAppointment>({
  startDate,
  endDate,
  days,
  mapAppointment,
  sortAppointments,
}: BuildDoctorWeekSectionsArgs<
  TBackendAppointment,
  TAppointment
>): DoctorWeekSection<TAppointment>[] {
  const grouped = new Map(
    days.map((day) => [
      day.date,
      sortAppointments(day.appointments.map(mapAppointment)),
    ]),
  );

  const sections: DoctorWeekSection<TAppointment>[] = [];
  const current = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  while (current.getTime() <= end.getTime()) {
    const date = formatDateOnly(current);
    const dayName = ARABIC_DAYS[current.getUTCDay()];

    sections.push({
      title: `${dayName} ${current.getUTCDate()} ${
        ARABIC_MONTHS[current.getUTCMonth()]
      }`,
      date,
      dayName,
      data: grouped.get(date) ?? [],
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return sections;
}
