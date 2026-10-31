# Reports & Analytics Module

Implements FE-36 (ticket IITM-77) — the consolidated Reports & Analytics Dashboard at `/analytics`.

- Key metrics across complaints, payments, residents, maintenance, visitors and facility usage.
- Complaint figures come live from `ComplaintContext`; other domains use static series in `mock/analytics.js`.
- Bar charts (shared `components/charts/SimpleBarChart`) with a last-3/6-months / YTD range filter.
- The on-screen summary can be exported as CSV.
- Charts show a clear empty state when a range has no data.
- Route is role-gated to President/Admin via `RoleRoute`.
