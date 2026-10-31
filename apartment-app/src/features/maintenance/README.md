# Maintenance

Manager-facing tracking of **reactive** and **preventive** maintenance across the
society. Management-only (wrapped in `RoleRoute`).

## Screens

| Route | Page | What it does |
| --- | --- | --- |
| `/maintenance/workload` | `WorkloadDashboardPage` | Workload dashboard: tasks assigned to each staff member — active / completed / overdue counts, a comparative workload bar, sortable + filterable |
| `/maintenance/work-orders` | `WorkOrdersPage` | Work-order board with create, assign, priority, status and overdue flags |
| `/maintenance/schedule` | `MaintenanceSchedulePage` | Manager scheduling screen: a form captures date, time and affected facilities; scheduled activities show on a calendar or list |
| `/maintenance/calendar` | `MaintenanceCalendarPage` | Month calendar of recurring preventive tasks linked to assets |
| `/maintenance/assets` | `AssetsPage` | Asset register with a dated maintenance history + outcomes per asset |

## Acceptance criteria mapping

- **Work-order board with create / assign / priority / status + overdue flags** →
  `WorkOrdersPage` + `WorkOrderBoard` (columns per status, priority chips, overdue
  badge from `isOverdue`) + `WorkOrderForm` (create/edit).
- **Maintenance calendar of recurring preventive tasks linked to assets** →
  `MaintenanceCalendarPage` + `MaintenanceCalendar`, fed by
  `preventiveTasks.js` cadence expansion (`getOccurrencesForMonth`). Each
  occurrence carries its linked asset.
- **Asset view lists maintenance history per asset with dates + outcomes** →
  `AssetsPage`, using `getHistoryForAsset` (completed work orders → dated history
  rows with recorded outcomes).
- **Creation and updates show validation and success states** → `WorkOrderForm`
  uses `react-hook-form` inline validation; the page shows a success `Snackbar`
  on every create / assign / advance / complete. Completing an order requires an
  outcome, which then flows into the asset history.

## Workload dashboard acceptance criteria

- **Each staff member shows active and completed task counts** →
  `WorkloadDashboardPage`, backed by `mock/workload.js` `getStaffWorkload`, which
  aggregates the work-order board by assignee into active (assigned / in progress),
  completed and overdue counts per person.
- **Workload is visualised** → `WorkloadBar` renders a stacked horizontal bar per
  staff member (overdue / active / completed), scaled to the busiest person's task
  count so loads are directly comparable at a glance.
- **Staff list is sortable and filterable** → sort by active, total, completed,
  overdue or name (`WORKLOAD_SORTS`); filter by trade (`WORKLOAD_TRADES`) and an
  "only staff with active tasks" toggle. Stat tiles summarise society-wide totals.

## Scheduling screen acceptance criteria

- **Form captures date, time and affected facilities** → `MaintenanceScheduleForm`
  (`react-hook-form`) with a date field, a time field and a multi-select of
  facilities from `ASSETS`, plus title / priority / optional owner / notes.
- **Scheduled events display on a calendar or list view** →
  `MaintenanceSchedulePage` toggles between `ScheduleCalendar` (month grid, one
  colour-coded chip per activity) and a chronological list.
- **Validation prevents empty required fields** → title, date, time and
  at-least-one facility are all required; each surfaces an inline error and
  blocks submit until filled.

## Data (mock singletons)

- `mock/assets.js` — assets/facilities, categories, operational status.
- `mock/workOrders.js` — work orders, statuses, priorities, staff, lifecycle
  helpers (`addWorkOrder`, `assignWorkOrder`, `advanceWorkOrder`,
  `setWorkOrderStatus`), `isOverdue`, `getHistoryForAsset`, `getBoardStats`.
- `mock/preventiveTasks.js` — recurring schedules + calendar occurrence expansion.
- `mock/scheduledEvents.js` — manager-created one-off scheduled activities
  (`addScheduledEvent`, `getEventMap`, `getEventsSorted`, `facilityNames`).

Mutations bump a local `version` counter on the page to re-read the singleton
arrays, matching the pattern used by the `workforce` feature.
