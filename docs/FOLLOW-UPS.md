# Follow-ups after Epic 5 integration

Things found while wiring INT-01/03/04/08/09/19/37/38 that were deliberately
left for later. Ordered roughly by how much they matter.

## 1. INT-27 (Communication) is not started

The backend is complete — circulars, polls, `/polls/{id}/vote`, `/results` —
but **the frontend screens do not exist**: no page, no route, no components.
`CommunicationPage` is only a hub linking to announcements, forum and events.

This is a build, not a wiring job: admin create-forms for circulars and polls,
resident lists with read indicators, one-vote-per-resident with a locked state,
and results tallies. Budget accordingly; it is not like the other INT stories.

## 2. No migration story

There is no Alembic setup, and `Base.metadata.create_all()` cannot add a column
to a table that already exists. `alembic` is in `requirements.txt` and
`app/main.py` already tells you to run `alembic upgrade head`, but there is no
`alembic.ini` and no `migrations/` directory.

Columns added this round that an existing `apartment.db` will be missing:

| Table         | Column                             |
|---------------|------------------------------------|
| announcements | `pinned`, `status`, `scheduled_for`|
| complaints    | `reference`                        |

Anyone pulling with an existing local database needs to `ALTER TABLE` those in
or delete the file and let it regenerate. Two options when picking this up:
a small idempotent schema-sync script, or setting Alembic up properly.

## 3. Documents auth still uses the interim header

`app/routers/documents.py` was built against the `X-User-Role` header stub that
BE-21 replaced elsewhere. `_get_role()` now reads a real bearer token first and
falls back to the header, so the UI works — but **the header path is still
there and is trivially spoofable** (`X-User-Role: admin` grants admin).

Finishing the migration means moving the router onto `require_roles(...)` and
updating the 43 header call sites in `tests/test_be38_documents.py`, the same
way `test_be39_audit_log.py` was migrated.

## 3b. Alerts and announcements have no role guard on the API  ⚠️

**A resident can broadcast a society-wide emergency alert.** Verified: a token
for an `owner` account posting to `POST /alerts/emergency` returns 201 and the
alert is delivered to every resident. `POST /announcements/` is the same — any
signed-in user can publish a notice.

Neither router has a role dependency. The frontend routes for both screens were
also unguarded; that half is now fixed (`RoleRoute` on `/communication/create`
and `/communication/emergency`), but **the API is still open** and the UI guard
is only a convenience — anyone can call the endpoint directly.

The fix is `Depends(require_roles("admin", "president", "secretary"))` on the
emergency broadcast and the announcement create/update routes. It was not done
in this pass because the announcement tests create notices without a token and
would all need token fixtures, the same migration `test_be39_audit_log.py` went
through. Worth doing before this is ever exposed to real users.

## 4. Human-readable references are only on complaints

Complaints now get `CMP-2026-0001` for display while the UUID stays the key.
Everything else still puts raw identifiers in front of users:

- announcements — integer ids
- documents, notifications, alerts — UUIDs

Worth giving the same treatment so references read consistently across the app.

Also: the complaint reference is allocated by counting that year's rows, which
is not safe against two submissions racing. A dedicated counter (or a unique
constraint plus retry) would be needed for real concurrency.

## 5. Notifications do not push

The navbar badge and the notification centre share state, so an action in
either updates both. But nothing polls, so a notification raised **elsewhere**
(another user's action, a broadcast) does not appear until the panel is opened
or the page is re-entered. Needs polling or websockets to be live.

## 6. Drafts and scheduling have no management screen

Announcement drafts are stored and retrievable via `GET /announcements/?status=draft`,
and scheduled notices are held back until their time — but there is no screen
listing drafts, so once saved a draft cannot be found, edited or published from
the UI. The API supports it; the screen does not exist.

## 7. Smaller things

- **Announcement search ignores pinned order.** The list endpoint sorts pinned
  first; `search_announcements` sorts only by date. The UI splits pinned into
  its own section so it is not visible, but the two endpoints disagree.
- **The announcements date filter reads `created_at`,** not `scheduled_for`, so
  a scheduled notice filters by when it was written rather than when it went out.
- **Blank-string validation gaps.** 16 inbound payload string fields have no
  length floor. 14 are foreign-key ids where a blank value fails the lookup
  anyway; `AuditLogCreate.module` and `.action` are free text and could store "".
- **MUI deprecation warnings** across the app (`InputLabelProps`,
  `primaryTypographyProps`, `InputProps`) — pre-existing, noisy in the console.
- **A cached session goes stale.** The signed-in user is stored at login, so
  linking a user to a resident record afterwards leaves `residentId` null until
  they sign out and back in. Notifications look empty until they do.

## Test accounts

| Email               | Password      | Role      | Notes                                  |
|---------------------|---------------|-----------|----------------------------------------|
| `demo@jkr.com`      | `password123` | president | Linked to flat A-402                   |
| `resident@jkr.com`  | `password123` | owner     | Same flat; needed for complaint screens |

Complaint routes are gated to resident roles, so the president account is
redirected away from `/complaints/new`.
