export interface ScheduleExceptionRangeInput {
  id: string;
  clinicId: string;
  exceptionDate: string;
  reason: string | null;
}

export interface ScheduleExceptionRange {
  id: string;
  ids: string[];
  clinicId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

export function groupScheduleExceptionRanges(
  exceptions: ScheduleExceptionRangeInput[],
): ScheduleExceptionRange[] {
  const sorted = [...exceptions].sort((a, b) => {
    const clinicCompare = a.clinicId.localeCompare(b.clinicId);
    if (clinicCompare !== 0) return clinicCompare;
    const reasonCompare = (a.reason ?? '').localeCompare(b.reason ?? '');
    if (reasonCompare !== 0) return reasonCompare;
    return a.exceptionDate.localeCompare(b.exceptionDate);
  });

  const ranges: ScheduleExceptionRange[] = [];

  for (const exception of sorted) {
    const previous = ranges.at(-1);
    if (
      previous &&
      previous.clinicId === exception.clinicId &&
      (previous.reason ?? '') === (exception.reason ?? '') &&
      getNextDate(previous.endDate) === exception.exceptionDate
    ) {
      previous.endDate = exception.exceptionDate;
      previous.ids.push(exception.id);
      continue;
    }

    ranges.push({
      id: exception.id,
      ids: [exception.id],
      clinicId: exception.clinicId,
      startDate: exception.exceptionDate,
      endDate: exception.exceptionDate,
      reason: exception.reason,
    });
  }

  return ranges;
}

function getNextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
