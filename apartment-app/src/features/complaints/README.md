# Complaints & Feedback Module

Implements the Complaints & Feedback screens assigned to Saharsh (Epic 2 — UI prototype, mock data only). All 10 scoped stories are implemented.

| Ticket  | Story | Screen | Route |
|---------|-------|--------|-------|
| IITM-20 | FE-01 | Complaint Submission | `/complaints/new` |
| IITM-21 | FE-02 | Complaint Status Tracking | `/complaints/:id` |
| IITM-25 | FE-06 | Complaint Assignment (Admin) | `/complaints/assign` |
| IITM-26 | FE-07 | Complaint Monitoring Dashboard (Admin) | `/complaints/monitoring` |
| IITM-29 | FE-10 | Complaint History | `/complaints` |
| IITM-32 | FE-13 | Complaint Category Selector | part of `/complaints/new` |
| IITM-33 | FE-14 | Complaint Reports (Admin) | `/complaints/reports` |
| IITM-35 | FE-16 | Complaint Progress Update (Staff) | `/complaints/progress` |
| IITM-39 | FE-20 | Feedback & Rating | `/complaints/feedback` |
| IITM-77 | FE-36 | Reports & Analytics Dashboard | `/analytics` (see `features/reports`) |

## Structure

- `mock/complaints.js` — statuses, fixed category enum (Plumbing, Electrical, Security, Water Supply, Lift Maintenance, Other), maintenance staff and seeded complaints with full stage timelines.
- `components/ComplaintStatusChip.jsx` — colour-coded status chip.
- `components/ComplaintStepper.jsx` — Submitted → Assigned → In Progress → Resolved → Closed stepper with per-stage timestamps.
- `pages/` — one page per user story (see table above).

## Backend integration

| Screen | Endpoint | Ticket |
|--------|----------|--------|
| Complaint Monitoring Dashboard | `GET /complaints/stats?months=N` | BE-07 |
| Feedback & Rating | `POST /complaints/{id}/feedback` | BE-20 |

- `src/services/complaintService.js` wraps the stats endpoint and maps the
  backend's snake_case contract to the camelCase shape the cards and charts
  use. It also exports `buildStatsFromComplaints()`, which computes the same
  payload from the in-memory complaint list.
- `src/hooks/useComplaintStats.js` fetches on mount and on window change. If
  the backend is unreachable (`NetworkError`) it falls back to the locally
  computed stats and flags `offline`, so `npm run dev` works without the API
  running. A backend that answers with an error (422/500) is surfaced to the
  user instead — we never hide a real failure behind sample data.
- Bucket mapping matches the API exactly: `pending` = submitted,
  `ongoing` = assigned + in_progress, `completed` = resolved + closed.
- `src/services/feedbackService.js` wraps the feedback endpoint and also owns
  the window helpers (`feedbackWindow`, `feedbackDeadline`). The 14-day rule
  is duplicated client-side on purpose: the backend is the authority and
  returns 410 either way, but re-checking locally means an expired complaint
  can be greyed out with the date it closed, rather than letting someone pick
  a rating, write a comment and only then be told they were too late.
  `FEEDBACK_WINDOW_DAYS` must stay in step with
  `complaint_service.FEEDBACK_WINDOW_DAYS`.
- `src/hooks/useComplaintFeedback.js` submits the rating. Unlike FE-19, it
  *does* fall back to a local write when offline — recording a rating on the
  device misleads nobody, whereas claiming an emergency alert was delivered
  would. Real backend errors (400 unresolved, 409 already rated, 410 window
  closed) always surface to the user.
- Expired complaints stay visible in the picker, greyed out with a "Window
  closed" chip, instead of disappearing. Complaints still open show how many
  days are left.

## Behaviour notes

- State lives in `src/context/ComplaintContext.jsx`; submissions, assignments, progress updates and feedback are shared across screens in-session.
- Progress updates only allow forward stage transitions; maintenance staff can advance a complaint up to Resolved, and management closes it after resident confirmation.
- Feedback is only offered on resolved/closed complaints and submit is disabled until a star rating is chosen.
- Residents see only their own complaints in history/feedback; management roles see all.
- Routes are role-gated via `RoleRoute`: submission/history/feedback → owner/tenant; assignment/monitoring/reports → president/admin; progress updates → president/admin/maintenance; complaint detail view → all of the above.

## End-to-end flow

A complaint now has a full path from submission to closure inside the prototype:

1. A resident submits a complaint (FE-01/FE-13) → status `Submitted`.
2. President/Admin assigns it to maintenance staff from the Complaint Desk (FE-06) → status `Assigned`.
3. Maintenance staff update progress from their task list (FE-16) → `In Progress` → `Resolved`.
4. Management closes the complaint after resident confirmation.
5. The resident can track every stage (FE-02), see it in history (FE-10), and rate the resolution (FE-20).
6. Aggregate counts and trends are visible on the Complaint Desk (FE-07), Complaint Reports (FE-14) and the cross-module Analytics dashboard (FE-36).
