# Facilities Feature

Resident-facing facility-booking screen: reserve the **gymnasium, swimming pool
or sports court** for an available time slot, view your bookings and cancel them.
Plus a management-only register so the Secretary can see who booked what and when.

## Ownership

- **Residents (Owner / Tenant):** select a facility, pick a day + slot, confirm a
  booking, view "My Bookings" and cancel upcoming ones.
- **Secretary (management):** views the society-wide booking register at
  `/facilities/bookings`, gated to `MANAGEMENT_ROLES` (`constants/roles.js`) via a
  `RoleRoute`. Maintenance/blocked slots are configured in `mock/facilities.js`
  (`BLOCKED_SLOTS`).

## Structure

| Path | Screen | Access |
|------|--------|--------|
| `/facilities` | Book a facility + My Bookings (with cancel) | Any logged-in resident |
| `/facilities/bookings` | Society-wide booking register (who / what / slot / when) | Management only |

## Slot states

Slots in the calendar are visually distinguished into four states
(`SLOT_STATE` in `mock/facilities.js`):

| State | Meaning | Bookable |
|-------|---------|----------|
| `available` | Free (green outline; shows spots left for shared facilities) | Yes |
| `booked` | Capacity reached by other residents (amber) | No |
| `blocked` | Held by Secretary for maintenance/events (red) | No |
| `past` | Day/time already elapsed (muted grey) | No |

## Acceptance criteria mapping

- **Selector + slot calendar showing availability** → `FacilitySelector` +
  `SlotCalendar` for gym / pool / court.
- **Book available slot, see in My Bookings with cancel** → `FacilityBookingPage`
  + `MyBookingsList`.
- **Booked / blocked / past slots visually distinguished** → `SlotCalendar`
  state styling + legend.
- **Confirmation + validation prevents invalid selections** → `ConfirmationDialog`
  on book, field-level errors, and a re-check that the slot is still available
  (guards against races, double-booking, blocked or elapsed slots).
- **Secretary sees who booked what and when** → `FacilityBookingsAdminPage`.
- **Owner/tenant book with time slot** → booking captures resident name, flat,
  role and the chosen slot.

## Notes

All data is mock/client-side (see `mock/`), consistent with the rest of the app.
Because the mock modules are singletons, a booking made on `/facilities` shows up
immediately in the Secretary register within the same session. State resets on
refresh. `getBookableDates()` is a rolling 7-day window from the current date.
