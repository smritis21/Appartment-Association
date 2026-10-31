# Communication Feature Module

Implements all communication-related frontend features for the Jains Kences Retreat management app.

## Feature Coverage

| Feature ID | Feature                      | Route(s)                          | Role          |
|------------|------------------------------|-----------------------------------|---------------|
| FE-03      | Notifications Panel          | Embedded in Navbar (bell icon)    | All Roles     |
| FE-04      | Announcements Dashboard      | `/announcements`                  | Residents     |
| FE-08      | Announcement Creation        | `/communication/create`           | President     |
| FE-09      | Announcement Search          | Part of `/announcements`          | Residents     |
| FE-19      | Emergency Alert Broadcast    | `/communication/emergency`        | President     |
| FE-27      | Communication Hub            | `/communication`                  | All Roles     |
| FE-29      | Discussion Forum & L&F       | `/forum`                          | Residents     |
| FE-31      | Community Events             | `/events`                         | Residents     |
| FE-34      | Community Corners            | `/corners`                        | Residents     |
| FE-37      | Notification Center          | `/notifications`                  | All Roles     |

## Directory Structure

```
src/features/communication/
├── index.js                  # Named exports for all pages + components
├── mock/
│   └── communicationData.js  # All mock data (notifications, announcements, events, etc.)
├── components/
│   └── NotificationsPanel.jsx  # FE-03: slide-over drawer integrated into Navbar
└── pages/
    ├── CommunicationPage.jsx        # FE-27: Hub
    ├── AnnouncementsPage.jsx        # FE-04 + FE-09
    ├── NotificationCenterPage.jsx   # FE-37
    ├── CreateAnnouncementPage.jsx   # FE-08
    ├── EmergencyAlertPage.jsx       # FE-19
    ├── ForumPage.jsx                # FE-29
    ├── EventsPage.jsx               # FE-31
    └── CornersPage.jsx              # FE-34
```

## Wiring

- **`Navbar.jsx`** — NotificationsPanel replaces static bell icon (FE-03)
- **`Sidebar.jsx`** — "Communication" section added with all 6 nav items
- **`AppRoutes.jsx`** — All 8 routes registered under `DashboardLayout`

## Backend Integration

| Screen | Endpoint | Ticket |
|--------|----------|--------|
| Emergency Alert Broadcast | `POST /alerts/emergency` | BE-19 |
| — follow-up delivery log   | `GET /alerts/{id}/deliveries?status=failed` | BE-19 |

- `src/services/alertService.js` wraps the alert endpoints and maps the
  snake_case contract to camelCase. It also owns the `TARGET_BLOCKS` mapping
  that turns the FE-19 target buttons (`all`, `tower_a`, …) into the API's
  optional `target_block`, so the page never has to know that "all" is
  expressed as an absent field.
- `src/hooks/useEmergencyBroadcast.js` sends the broadcast. It does **not**
  fetch on mount — broadcasting is an explicit, irreversible action, so it
  only runs when the President confirms.
- The confirmation screen reports the real outcome the backend returns:
  how many residents were reached, and a named list of anyone who was not,
  with the reason. That list is the point of the story — someone has to
  knock on those doors.
- If the backend is unreachable the alert is reported as **not delivered**
  rather than falling back to a fake success. This deliberately differs from
  the read-only screens (FE-05, FE-07), which serve mock data when offline:
  telling a President their fire alarm went out when it did not would be
  worse than telling them nothing. A backend that answers with an error
  (400 unknown block, 422 validation) keeps the draft on screen so it can be
  corrected and resent.

## Tech Stack

- React 19, React Router v7, MUI v9 (`@mui/material`), `@mui/icons-material`
- Most state is local (`useState`) with mock data in `communicationData.js`;
  FE-19 is wired to the live API (see above)
- No external libraries added; follows identical patterns to existing features

## Mock Data

All data lives in `mock/communicationData.js` and uses module-level mutable arrays with exported getter/setter functions — matching the pattern in `features/reminders/mock/reminders.js`.

## Merge Notes

- Zero breaking changes to existing routes or features
- All new files are in `features/communication/` — no edits to existing feature files
- `Navbar.jsx`, `Sidebar.jsx`, and `AppRoutes.jsx` were extended, not rewritten
