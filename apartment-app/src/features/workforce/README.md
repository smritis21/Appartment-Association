# Workforce Feature

Screens for booking, logging and rating the people who work in the society:
**house help** (maid, cook, driver, nanny, gardener) and **service providers**
(plumber, electrician, carpenter, painter, pest control, AC technician). Plus a
management-only register for oversight and service-job assignment.

## Ownership

- **Residents (Owner / Tenant):** browse the house-help directory by category,
  book an available helper, log entry/exit attendance, rate completed services,
  and raise + track service-provider jobs.
- **Management (Admin / Secretary / President):** view the society-wide register
  at `/workforce/manage` (gated to `MANAGEMENT_ROLES` in `constants/roles.js` via
  a `RoleRoute`) — all bookings, attendance, ratings, and service-job assignment.

## Structure

| Path | Screen | Access |
|------|--------|--------|
| `/workforce` | House-Help Directory + My Bookings | Any logged-in resident |
| `/workforce/attendance` | Entry-Log / Attendance + rate completed services | Any logged-in resident |
| `/workforce/services` | Service Providers directory + My Jobs / history | Any logged-in resident |
| `/workforce/manage` | Workforce Register (bookings, attendance, ratings, job assignment) | Management only |

## House-help availability states

Workers are visually distinguished by availability (`AVAILABILITY` in
`mock/houseHelp.js`); only `available` workers can be booked:

| State | Meaning | Bookable |
|-------|---------|----------|
| `available` | Free to be booked (green chip) | Yes |
| `busy` | Fully booked elsewhere (amber chip) | No |
| `off` | On leave (grey chip) | No |

## Booking lifecycle

`requested → confirmed → completed` (or `cancelled`). A booking is only ratable
once it is `completed`. See `mock/bookings.js`.

## Service-job lifecycle

`open → assigned → in_progress → completed` (or `cancelled`). Residents raise an
`open` job; management assigns it to a provider and advances it. Every step is
timestamped in the job's `history` (the service history). See
`mock/serviceProviders.js`.

## Acceptance-criteria mapping

- **House-help directory by category showing availability, profiles and booking**
  → `CategoryFilter` + `HouseHelpCard` (avatar, verified badge, live rating,
  rate, availability chip) + `BookingDialog` on `HouseHelpDirectoryPage`.
- **Entry-log / attendance capture** → `AttendanceLogPage` check-in / check-out
  with computed hours (`AttendanceTable`, `mock/attendance.js`).
- **Star-rating + comment after completed service** → `RatingDialog` (MUI
  `Rating`, 1–5 required, optional comment) shown for completed bookings; new
  ratings blend into the worker's live average (`mock/ratings.js`).
- **Service-provider job assignment and service history** → residents raise jobs
  on `ServiceProvidersPage` (`ServiceRequestDialog`, `JobCard` with history
  timeline); management assigns providers and advances jobs on
  `WorkforceAdminPage`.
- **Validation, availability distinctions and success states** → field-level
  validation on all dialogs, re-checks against double-booking / clashes, disabled
  actions for unavailable workers, and success alerts + snackbars on every
  booking, rating and job action.

## Notes

All data is mock / client-side (see `mock/`), consistent with the rest of the
app. The mock modules are singletons, so a booking or job raised on a resident
screen shows up immediately in the management register within the same session.
State resets on refresh.
