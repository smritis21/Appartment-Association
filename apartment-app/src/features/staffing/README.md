# Staffing (staff roster & attendance)

Manager-facing screens for running the society's own staff — maintenance,
security and housekeeping. Distinct from `features/workforce`, which is
resident-facing house help.

## User story

> As the Manager, I want attendance and shift screens so that staff presence and
> rosters are managed.

## Screens

| Route | Page | Purpose |
| --- | --- | --- |
| `/staffing/roster` | `RosterPage` | Assign staff to shifts by day; flags understaffed slots and conflicts. |
| `/staffing/attendance` | `AttendancePage` | Mark present/absent/leave per staff per day; live coverage summary. |

Both routes are gated to `MANAGEMENT_ROLES` (admin / secretary / president).

## Acceptance criteria → where it lives

- **Roster assigns maintenance/security/housekeeping staff to shifts by day** —
  `RosterPage` + `RosterGrid`, backed by `mock/roster.js` (`assignShift`). A day
  strip (`DaySelector`) drives the view; each department shows morning / evening
  / night slots.
- **Attendance (present/absent/leave) captured per staff per day** —
  `AttendancePage` + `AttendanceMarker`, backed by `mock/attendance.js`
  (`markAttendance`, upsert per staff+day).
- **Shift conflicts and understaffed slots visually flagged** — understaffed
  slots get a red border + "short N" badge (`slotCoverage`); staff double-booked
  on a day are flagged red with a tooltip and summarised in an alert
  (`conflictsOnDay`).
- **Validation + success states, and a daily coverage summary** — every assign /
  mark runs validation and shows an inline error or a success toast;
  `CoverageSummary` shows present-vs-required per shift, and stat tiles summarise
  the day.

## Domain model

- **Departments**: maintenance, security, housekeeping (`mock/staff.js`).
- **Shifts**: morning (06:00–14:00), evening (14:00–22:00), night (22:00–06:00).
- **Requirements**: min headcount per department+shift drives understaffing
  (`SHIFT_REQUIREMENTS` / `requiredFor`). `0` means the department doesn't run
  that shift (housekeeping has no night crew).
- **Roster** vs **attendance**: the roster is the plan (who *should* work);
  attendance is the actual (who *did*). Coverage on the attendance screen is
  presence-aware, so a slot full on the roster can still read short once leave
  and absence are counted.

## Notes

Mock data are session singletons (like `features/maintenance`). Mutations are
visible across screens for the session but reset on reload. Seed data centre on
the week of 2026-07-20 with today (2026-07-22) deliberately thin so understaffing
and conflicts are visible out of the box.
