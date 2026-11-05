export interface PeriodSlot {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
}

export interface CourseSection {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  semester: string;
  sectionCode: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  classType: 'lecture' | 'practical';
  meetingCount: number;
  linkedSectionId: string | null;
  startDate: string | null;
  endDate: string | null;
  secondDayOfWeek: number | null;
  secondStartPeriod: number | null;
  secondEndPeriod: number | null;
  room: string | null;
  lecturer: string | null;
  capacity: number | null;
  isCancelled: boolean;
}

export interface ScheduleItem {
  id: string;
  sectionId: string | null;
  title: string;
  semester: string | null;
  weekStart: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  startTime: string;
  endTime: string;
  room: string | null;
  note: string | null;
  createdAt: string;
}

/** Normalized meeting used by the conflict engine (no DB dependencies). */
export interface ScheduleMeeting {
  id: string;
  kind: 'section' | 'item';
  code: string;
  title: string;
  dayOfWeek: number;
  startPeriod: number;
  endPeriod: number;
  room: string | null;
  isCancelled: boolean;
  sectionId: string | null;
}

export interface ConflictParty {
  id: string;
  kind: 'section' | 'item';
  code: string;
  title: string;
  room: string | null;
}

export type ConflictType = 'section-section' | 'section-item';

export interface ScheduleConflict {
  type: ConflictType;
  dayOfWeek: number;
  overlapStartPeriod: number;
  overlapEndPeriod: number;
  first: ConflictParty;
  second: ConflictParty;
}

export interface SimulationCore {
  conflicts: ScheduleConflict[];
  cancelledSectionIds: string[];
}
