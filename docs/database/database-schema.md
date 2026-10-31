# Database Schema

## Apartment Association Management System
**Project:** Jains Kences Retreat · Rough Schema v1

---

# 1. Introduction

This document defines the rough database schema for the Apartment Association Management System. It covers all 16 modules and approximately 26 tables. This is a working draft — field names, types, and constraints will be refined during the backend implementation sprint (Epic 3).

The database is planned to be implemented in **PostgreSQL**.

---

# 2. Design Principles

- Every table has a single-column primary key (UUID or SERIAL)
- Foreign keys are explicit — no implicit joins
- ENUMs are used for fixed status fields
- No module stores resident data independently — all reference the `residents` table
- Reports & Analytics has no table — it derives data from existing tables
- Community Hub is split into multiple tables — it is a collection of independent features

---

# 3. Database Tables

---

## 3.1 Authentication

### users
| Field | Type | Constraints |
|-------|------|-------------|
| user_id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR | NOT NULL |
| role_id | INTEGER | FK → roles.role_id |
| status | ENUM | active / inactive |
| created_at | TIMESTAMP | DEFAULT now() |

### roles
| Field | Type | Constraints |
|-------|------|-------------|
| role_id | SERIAL | PK |
| role_name | VARCHAR(50) | UNIQUE, NOT NULL |

**Role values:** owner, tenant, president, secretary, manager, maintenance_staff, security_guard

---

## 3.2 Residents

### residents
| Field | Type | Constraints |
|-------|------|-------------|
| resident_id | UUID | PK |
| user_id | UUID | FK → users.user_id |
| flat_id | UUID | FK → flats.flat_id |
| name | VARCHAR(100) | NOT NULL |
| phone | VARCHAR(15) | |
| occupation | VARCHAR(100) | |
| move_in_date | DATE | |
| move_out_date | DATE | |
| status | ENUM | active / inactive / moved_out |

### flats
| Field | Type | Constraints |
|-------|------|-------------|
| flat_id | UUID | PK |
| block | VARCHAR(10) | NOT NULL |
| floor | INTEGER | |
| flat_number | VARCHAR(10) | NOT NULL |
| ownership_type | ENUM | owned / rented |
| occupancy_status | ENUM | occupied / vacant |

### family_members
| Field | Type | Constraints |
|-------|------|-------------|
| member_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| name | VARCHAR(100) | NOT NULL |
| relation | VARCHAR(50) | |
| phone | VARCHAR(15) | |

### emergency_contacts
| Field | Type | Constraints |
|-------|------|-------------|
| contact_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| name | VARCHAR(100) | NOT NULL |
| relationship | VARCHAR(50) | |
| phone | VARCHAR(15) | NOT NULL |

---

## 3.3 Onboarding

### applications
| Field | Type | Constraints |
|-------|------|-------------|
| application_id | UUID | PK |
| applicant_name | VARCHAR(100) | NOT NULL |
| resident_type | ENUM | owner / tenant |
| flat_id | UUID | FK → flats.flat_id |
| status | ENUM | pending / approved / rejected |
| submitted_on | TIMESTAMP | DEFAULT now() |
| approved_by | UUID | FK → users.user_id |
| rejection_reason | TEXT | |

### onboarding_documents
| Field | Type | Constraints |
|-------|------|-------------|
| document_id | UUID | PK |
| application_id | UUID | FK → applications.application_id |
| document_type | VARCHAR(50) | NOT NULL |
| file_path | VARCHAR | NOT NULL |
| verification_status | ENUM | pending / verified / rejected |

---

## 3.4 Complaints

### complaints
| Field | Type | Constraints |
|-------|------|-------------|
| complaint_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| category | ENUM | plumbing / electrical / security / water / lift / other |
| priority | ENUM | low / medium / high |
| description | TEXT | NOT NULL |
| location | VARCHAR(100) | |
| status | ENUM | submitted / assigned / in_progress / resolved / closed |
| assigned_staff_id | UUID | FK → staff.staff_id |
| created_at | TIMESTAMP | DEFAULT now() |
| resolved_at | TIMESTAMP | |

### complaint_feedback
| Field | Type | Constraints |
|-------|------|-------------|
| feedback_id | UUID | PK |
| complaint_id | UUID | FK → complaints.complaint_id |
| resident_id | UUID | FK → residents.resident_id |
| rating | INTEGER | CHECK 1–5 |
| comments | TEXT | |
| submitted_at | TIMESTAMP | DEFAULT now() |

---

## 3.5 Maintenance

### work_orders
| Field | Type | Constraints |
|-------|------|-------------|
| work_order_id | UUID | PK |
| complaint_id | UUID | FK → complaints.complaint_id, nullable |
| staff_id | UUID | FK → staff.staff_id, NOT NULL |
| description | TEXT | |
| priority | ENUM | low / medium / high |
| status | ENUM | open / in_progress / completed / overdue |
| due_date | DATE | |
| completed_at | TIMESTAMP | |

### assets
| Field | Type | Constraints |
|-------|------|-------------|
| asset_id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| location | VARCHAR(100) | |
| last_service_date | DATE | |
| next_service_date | DATE | |

---

## 3.6 Visitors

### visitors
| Field | Type | Constraints |
|-------|------|-------------|
| visitor_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| visitor_name | VARCHAR(100) | NOT NULL |
| purpose | VARCHAR(100) | |
| pass_code | VARCHAR(20) | UNIQUE |
| valid_from | TIMESTAMP | |
| valid_until | TIMESTAMP | |
| entry_time | TIMESTAMP | |
| exit_time | TIMESTAMP | |
| status | ENUM | pending / active / expired / completed |

---

## 3.7 Workforce

### house_help
| Field | Type | Constraints |
|-------|------|-------------|
| helper_id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| category | ENUM | maid / cook / driver / gardener / laundry / iron |
| phone | VARCHAR(15) | |
| availability | BOOLEAN | DEFAULT true |
| avg_rating | DECIMAL(3,2) | |

### service_providers
| Field | Type | Constraints |
|-------|------|-------------|
| provider_id | UUID | PK |
| company_name | VARCHAR(100) | |
| service_type | ENUM | plumber / electrician / pest_control / lift / cleaning |
| phone | VARCHAR(15) | |
| avg_rating | DECIMAL(3,2) | |

### assigned_jobs
| Field | Type | Constraints |
|-------|------|-------------|
| job_id | UUID | PK |
| provider_id | UUID | FK → service_providers.provider_id |
| resident_id | UUID | FK → residents.resident_id |
| description | TEXT | |
| status | ENUM | assigned / in_progress / completed |
| assigned_on | TIMESTAMP | DEFAULT now() |

---

## 3.8 Announcements & Communication

### announcements
| Field | Type | Constraints |
|-------|------|-------------|
| announcement_id | UUID | PK |
| title | VARCHAR(200) | NOT NULL |
| content | TEXT | NOT NULL |
| category | ENUM | general / circular / meeting / emergency |
| created_by | UUID | FK → users.user_id |
| priority | ENUM | normal / high |
| published_at | TIMESTAMP | |
| scheduled_at | TIMESTAMP | |

### polls
| Field | Type | Constraints |
|-------|------|-------------|
| poll_id | UUID | PK |
| question | TEXT | NOT NULL |
| created_by | UUID | FK → users.user_id |
| status | ENUM | open / closed |
| closes_at | TIMESTAMP | |

### poll_options
| Field | Type | Constraints |
|-------|------|-------------|
| option_id | UUID | PK |
| poll_id | UUID | FK → polls.poll_id |
| option_text | VARCHAR(200) | NOT NULL |
| vote_count | INTEGER | DEFAULT 0 |

### poll_votes
| Field | Type | Constraints |
|-------|------|-------------|
| vote_id | UUID | PK |
| poll_id | UUID | FK → polls.poll_id |
| user_id | UUID | FK → users.user_id |
| option_id | UUID | FK → poll_options.option_id |
| voted_at | TIMESTAMP | DEFAULT now() |

---

## 3.9 Payments & Billing

### bills
| Field | Type | Constraints |
|-------|------|-------------|
| bill_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| billing_month | VARCHAR(20) | NOT NULL |
| maintenance | DECIMAL(10,2) | |
| water | DECIMAL(10,2) | |
| parking | DECIMAL(10,2) | |
| miscellaneous | DECIMAL(10,2) | |
| discount | DECIMAL(10,2) | DEFAULT 0 |
| gst | DECIMAL(10,2) | |
| total_amount | DECIMAL(10,2) | NOT NULL |
| due_date | DATE | NOT NULL |
| status | ENUM | pending / paid / overdue / partially_paid |

### payments
| Field | Type | Constraints |
|-------|------|-------------|
| payment_id | UUID | PK |
| bill_id | UUID | FK → bills.bill_id |
| resident_id | UUID | FK → residents.resident_id |
| amount_paid | DECIMAL(10,2) | NOT NULL |
| payment_method | ENUM | upi / online_transfer / cheque / cash |
| paid_on | TIMESTAMP | DEFAULT now() |
| receipt_no | VARCHAR(50) | UNIQUE |
| transaction_ref | VARCHAR(100) | |

---

## 3.10 Community Hub

### posts
| Field | Type | Constraints |
|-------|------|-------------|
| post_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| category | ENUM | general / suggestions / lost_found / recommendations |
| title | VARCHAR(200) | |
| content | TEXT | NOT NULL |
| is_resolved | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |

### comments
| Field | Type | Constraints |
|-------|------|-------------|
| comment_id | UUID | PK |
| post_id | UUID | FK → posts.post_id |
| resident_id | UUID | FK → residents.resident_id |
| content | TEXT | NOT NULL |
| created_at | TIMESTAMP | DEFAULT now() |

### events
| Field | Type | Constraints |
|-------|------|-------------|
| event_id | UUID | PK |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| event_date | TIMESTAMP | NOT NULL |
| venue | VARCHAR(100) | |
| capacity | INTEGER | |
| created_by | UUID | FK → users.user_id |
| status | ENUM | upcoming / ongoing / completed / cancelled |

### event_registrations
| Field | Type | Constraints |
|-------|------|-------------|
| registration_id | UUID | PK |
| event_id | UUID | FK → events.event_id |
| resident_id | UUID | FK → residents.resident_id |
| type | ENUM | rsvp / volunteer |
| registered_at | TIMESTAMP | DEFAULT now() |

### marketplace_listings
| Field | Type | Constraints |
|-------|------|-------------|
| listing_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| price | DECIMAL(10,2) | |
| category | VARCHAR(50) | |
| status | ENUM | available / sold |
| listed_at | TIMESTAMP | DEFAULT now() |

### facility_bookings
| Field | Type | Constraints |
|-------|------|-------------|
| booking_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| facility | ENUM | gym / pool / sports_court |
| slot_date | DATE | NOT NULL |
| slot_time | VARCHAR(20) | NOT NULL |
| status | ENUM | confirmed / cancelled |
| booked_at | TIMESTAMP | DEFAULT now() |

### temple_bookings
| Field | Type | Constraints |
|-------|------|-------------|
| booking_id | UUID | PK |
| resident_id | UUID | FK → residents.resident_id |
| seva_type | ENUM | monthly_pooja / abhishekam / archana / sandhana_kaapu |
| booking_date | DATE | NOT NULL |
| slot | VARCHAR(20) | |
| amount | DECIMAL(10,2) | |
| status | ENUM | confirmed / cancelled |

### community_activities
| Field | Type | Constraints |
|-------|------|-------------|
| activity_id | UUID | PK |
| corner | ENUM | kids / senior / recreational / social |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | |
| activity_date | DATE | |
| capacity | INTEGER | |
| status | ENUM | upcoming / completed / cancelled |

### activity_signups
| Field | Type | Constraints |
|-------|------|-------------|
| signup_id | UUID | PK |
| activity_id | UUID | FK → community_activities.activity_id |
| resident_id | UUID | FK → residents.resident_id |
| signed_up_at | TIMESTAMP | DEFAULT now() |

---

## 3.11 Staff Management

### staff
| Field | Type | Constraints |
|-------|------|-------------|
| staff_id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| department | ENUM | maintenance / security / housekeeping |
| phone | VARCHAR(15) | |
| shift | ENUM | morning / afternoon / night |
| status | ENUM | active / inactive |

### attendance
| Field | Type | Constraints |
|-------|------|-------------|
| attendance_id | UUID | PK |
| staff_id | UUID | FK → staff.staff_id |
| date | DATE | NOT NULL |
| status | ENUM | present / absent / leave |

---

## 3.12 Shared Services

### notifications
| Field | Type | Constraints |
|-------|------|-------------|
| notification_id | UUID | PK |
| user_id | UUID | FK → users.user_id |
| type | VARCHAR(50) | NOT NULL |
| message | TEXT | NOT NULL |
| is_read | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMP | DEFAULT now() |

### society_documents
| Field | Type | Constraints |
|-------|------|-------------|
| document_id | UUID | PK |
| title | VARCHAR(200) | NOT NULL |
| category | ENUM | rules / agm_minutes / circulars / resident_docs / certificates |
| file_path | VARCHAR | NOT NULL |
| uploaded_by | UUID | FK → users.user_id |
| uploaded_at | TIMESTAMP | DEFAULT now() |

### audit_logs
| Field | Type | Constraints |
|-------|------|-------------|
| log_id | UUID | PK |
| user_id | UUID | FK → users.user_id |
| module | VARCHAR(50) | NOT NULL |
| action | VARCHAR(100) | NOT NULL |
| target_id | VARCHAR(100) | |
| timestamp | TIMESTAMP | DEFAULT now() |

### user_settings
| Field | Type | Constraints |
|-------|------|-------------|
| setting_id | UUID | PK |
| user_id | UUID | FK → users.user_id, UNIQUE |
| language | VARCHAR(10) | DEFAULT 'en' |
| notifications_enabled | BOOLEAN | DEFAULT true |
| privacy_level | ENUM | public / members_only / private |

---

# 4. Relationships

```
users (1) ──────── (1) residents
residents (1) ──── (many) complaints
residents (1) ──── (many) bills
bills (1) ────────── (1) payments
complaints (1) ──── (1) work_orders
complaints (1) ──── (1) complaint_feedback
residents (1) ──── (many) visitors
residents (1) ──── (many) family_members
residents (1) ──── (many) emergency_contacts
flats (1) ────────── (many) residents
applications (1) ── (many) onboarding_documents
events (1) ────────── (many) event_registrations
polls (1) ────────── (many) poll_options
polls (1) ────────── (many) poll_votes
community_activities (1) ── (many) activity_signups
staff (1) ────────── (many) attendance
staff (1) ────────── (many) work_orders
users (1) ────────── (1) user_settings
users (1) ────────── (many) notifications
users (1) ────────── (many) audit_logs
```

---

# 5. Constraints

- `users.email` must be unique across the entire system
- Each flat can have only one resident with status `active` and role `owner` at a time
- `payments` cannot exist without a corresponding `bills` record
- `work_orders.staff_id` is NOT NULL — every work order must have an assigned staff member
- `facility_bookings` cannot have two confirmed bookings for the same facility + slot_date + slot_time
- `poll_votes` enforces one vote per user per poll (UNIQUE on poll_id + user_id)
- `complaint_feedback` can only be submitted for complaints with status `resolved` or `closed`
- `temple_bookings` cannot have two confirmed bookings for the same seva_type + booking_date + slot
- `audit_logs` are immutable — no UPDATE or DELETE permitted on this table

---

# 6. Indexing Strategy

| Table | Index Column | Reason |
|-------|-------------|--------|
| users | email | Login lookup |
| residents | flat_id | Flat-based queries |
| complaints | status | Filter by status |
| complaints | resident_id | Resident complaint history |
| bills | status | Pending/overdue queries |
| bills | resident_id | Resident bill lookup |
| notifications | user_id | Per-user notification fetch |
| audit_logs | user_id, timestamp | Filtered log queries |
| facility_bookings | facility, slot_date | Conflict detection |
| visitors | resident_id | Resident visitor history |
| attendance | staff_id, date | Daily attendance lookup |

---

# 7. Future Enhancements

- Add `refresh_tokens` table for JWT refresh token management
- Add `payment_reminders` table for scheduled reminder tracking
- Add `maintenance_schedules` table for recurring preventive tasks
- Add `wishlist` table for marketplace feature
- Add `donations` table for temple module
- Partition `audit_logs` by month for performance at scale
- Add full-text search index on `complaints.description` and `posts.content`
