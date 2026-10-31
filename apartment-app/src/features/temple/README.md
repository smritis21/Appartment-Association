# Temple Feature

Resident-facing temple screen: book monthly poojas/sevas, donate with an instant
receipt, and view/volunteer for temple events.

## Ownership

- **Residents (Owner / Tenant):** book sevas, donate, view events, volunteer.
- **Secretary (temple administration owner):** publishes and manages temple
  events. The "Publish Event" action on the Events page is gated to
  `MANAGEMENT_ROLES` (`constants/roles.js`) and is the Secretary's responsibility.

The Secretary is chosen over the President because publishing events, managing
seva schedules and reconciling donations is recurring day-to-day operational
work — the Secretary's domain. The President is an oversight/approving role.

## Structure

| Path | Screen |
|------|--------|
| `/temple` | Temple dashboard (stats + quick actions) |
| `/temple/book` | Seva booking with slot picker |
| `/temple/donate` | Donation form |
| `/temple/donate/receipt` | Donation receipt (issued state) |
| `/temple/events` | Events list + volunteer signup |

## Notes

All data is mock/client-side (see `mock/`), consistent with the rest of the app.
Bookings, donations and receipts are UI state only and reset on refresh.
