import { Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import DashboardLayout from "../layouts/DashboardLayout";
import OnboardingLayout from "../layouts/OnboardingLayout";
import ProtectedRoute from "./ProtectedRoute";
import {
  LoginPage,
  SignUpPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ProfilePage,
  ChangePasswordPage,
} from "../features/auth";
import {
  RegistrationTypePage,
  OwnerRegistrationPage,
  TenantRegistrationPage,
  DocumentUploadPage,
  KYCVerificationPage,
  ApprovalStatusPage,
  ApprovalQueuePage,
} from "../features/onboarding";
import { VisitorApprovalPage, MyPassesPage, GateDeskPage } from "../features/visitors";
import { AssistantPage } from "../features/assistant";
import RoleRoute from "./RoleRoutes";
import { ROLES, MANAGEMENT_ROLES } from "../constants/roles";
import {
  ComplaintSubmissionPage,
  ComplaintTrackingPage,
  ComplaintHistoryPage,
  ComplaintAssignmentPage,
  ComplaintMonitoringPage,
  ComplaintReportsPage,
  ProgressUpdatePage,
  FeedbackPage,
} from "../features/complaints";
import { AnalyticsDashboardPage } from "../features/reports";
import { HomePage } from "../features/home";
import { TermsPage, PrivacyPolicyPage } from "../features/legal";
import {
  TempleDashboardPage,
  SevaBookingPage,
  DonationPage,
  ReceiptPage as TempleReceiptPage,
  EventsPage as TempleEventsPage,
  TempleManagePage,
} from "../features/temple";
import {
  FacilityBookingPage,
  FacilityBookingsAdminPage,
} from "../features/facilities";
import {
  HouseHelpDirectoryPage,
} from "../features/workforce";
import {
  WorkOrdersPage,
  MaintenanceCalendarPage,
  MaintenanceSchedulePage,
  AssetsPage,
  WorkloadDashboardPage,
} from "../features/maintenance";
import { MarketplacePage } from "../features/marketplace";
import { DashboardPage } from "../features/dashboard";

const RESIDENT_ROLES = [ROLES.OWNER, ROLES.TENANT];
const COMPLAINT_ADMIN_ROLES = [ROLES.PRESIDENT, ROLES.ADMIN];
// Publishing notices and broadcasting emergencies belong to the committee.
const COMMUNICATION_ADMIN_ROLES = [ROLES.PRESIDENT, ROLES.SECRETARY, ROLES.ADMIN];
const COMPLAINT_VIEW_ROLES = [...RESIDENT_ROLES, ...COMPLAINT_ADMIN_ROLES, ROLES.MAINTENANCE];
// Bug 4: the gate desk checks visitors in/out - that's a security guard and
// management job, not something a resident needs (or should be able to use
// to wave their own visitors through).
const GATE_DESK_ROLES = [ROLES.SECURITY, ...MANAGEMENT_ROLES];
import {
  ResidentManagementPage,
  ResidentDetailPage,
} from "../features/residents";
import {
  DirectoryPage,
  FlatDetailPage,
  OwnerDetailPage,
  TenantDetailPage,
} from "../features/directory";
import {
  BillingDashboardPage,
  GenerateBillPage,
  InvoiceDetailPage,
} from "../features/billing";
import {
  DocumentManagementPage,
  DocumentDetailPage,
  UploadDocumentPage,
} from "../features/documents";
import {
  PaymentDashboardPage,
  PayBillPage,
  PaymentHistoryPage,
  ReceiptPage,
  PaymentSuccessPage,
} from "../features/payments";
import {
  RemindersPage,
  ReminderDetailPage,
} from "../features/reminders";
import {
  AuditLogsPage,
  LoginLogsPage,
  ActivityLogsPage,
} from "../features/audit";
import {
  SettingsDashboardPage,
  ProfileSettingsPage,
  NotificationSettingsPage,
  SecuritySettingsPage,
  AppearanceSettingsPage,
  ApartmentSettingsPage,
  SystemSettingsPage,
  AboutPage,
} from "../features/settings";

// ── FE-03, FE-04, FE-08, FE-09, FE-19, FE-27, FE-29, FE-31, FE-34, FE-37 ──
import {
  CommunicationPage,
  AnnouncementsPage,
  NotificationCenterPage,
  CreateAnnouncementPage,
  EmergencyAlertPage,
  ForumPage,
  EventsPage,
  CornersPage,
} from "../features/communication";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/signup"          element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
      </Route>

      {/* Bug 3: resident onboarding wizard - FE-22. A brand-new visitor has
          no account yet, and even after registering here their account is
          "pending" and can't log in until approved (see
          backend/app/services/auth_service.py::login), so this whole flow
          has to live in the public route group alongside /login and /signup
          rather than behind ProtectedRoute. */}
      <Route element={<OnboardingLayout />}>
        <Route path="/onboarding"          element={<RegistrationTypePage />} />
        <Route path="/onboarding/register" element={<RegistrationTypePage />} />
        <Route path="/onboarding/owner"    element={<OwnerRegistrationPage />} />
        <Route path="/onboarding/tenant"   element={<TenantRegistrationPage />} />
        <Route path="/onboarding/upload"   element={<DocumentUploadPage />} />
        <Route path="/onboarding/kyc"      element={<KYCVerificationPage />} />
        <Route path="/onboarding/status"   element={<ApprovalStatusPage />} />
      </Route>

      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/profile"         element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Bug 4: management can review pending applications, but the
              registration wizard itself moved to the public route group
              below - it has to be reachable by people who don't have an
              account yet (see Bug 3). */}
          <Route element={<RoleRoute allowedRoles={MANAGEMENT_ROLES} />}>
            <Route path="/onboarding/approval-queue" element={<ApprovalQueuePage />} />
          </Route>

          {/* Visitors - FE-05 */}
          <Route path="/visitors/approvals" element={<VisitorApprovalPage />} />

          {/* Visitor Management - FE-25 */}
          <Route path="/visitors/passes" element={<MyPassesPage />} />
          {/* Bug 4: gate desk is security/management only, not resident-facing */}
          <Route element={<RoleRoute allowedRoles={GATE_DESK_ROLES} />}>
            <Route path="/visitors/gate" element={<GateDeskPage />} />
          </Route>

          {/* AI - Community Assistant */}
          <Route element={<RoleRoute allowedRoles={[...RESIDENT_ROLES, ...MANAGEMENT_ROLES, ROLES.MAINTENANCE]} />}>
            <Route path="/assistant" element={<AssistantPage />} />
          </Route>

          {/* Temple - book poojas/sevas, donate, events & volunteering */}
          <Route path="/temple" element={<TempleDashboardPage />} />
          <Route path="/temple/book" element={<SevaBookingPage />} />
          <Route path="/temple/donate" element={<DonationPage />} />
          <Route path="/temple/donate/receipt" element={<TempleReceiptPage />} />
          <Route path="/temple/events" element={<TempleEventsPage />} />
          <Route element={<RoleRoute />}>
            <Route path="/temple/manage" element={<TempleManagePage />} />
          </Route>

          {/* Facilities - book gym / pool / court */}
          <Route path="/facilities" element={<FacilityBookingPage />} />
          <Route element={<RoleRoute />}>
            <Route path="/facilities/bookings" element={<FacilityBookingsAdminPage />} />
          </Route>

          {/* House Help directory */}
          <Route path="/workforce" element={<HouseHelpDirectoryPage />} />

          {/* Maintenance - Manager: work orders, preventive calendar & assets */}
          <Route element={<RoleRoute />}>
            <Route path="/maintenance/workload" element={<WorkloadDashboardPage />} />
            <Route path="/maintenance/work-orders" element={<WorkOrdersPage />} />
            <Route path="/maintenance/schedule" element={<MaintenanceSchedulePage />} />
            <Route path="/maintenance/calendar" element={<MaintenanceCalendarPage />} />
            <Route path="/maintenance/assets" element={<AssetsPage />} />
          </Route>

          {/* Marketplace - FE-30 */}
          <Route path="/marketplace" element={<MarketplacePage />} />

          {/* Residents - FE-18. Bug 4: managing the resident roster (create,
              edit, deactivate) is a management job. */}
          <Route element={<RoleRoute allowedRoles={MANAGEMENT_ROLES} />}>
            <Route path="/residents"          element={<ResidentManagementPage />} />
            <Route path="/residents/new"      element={<ResidentManagementPage />} />
            <Route path="/residents/:id"      element={<ResidentDetailPage />} />
            <Route path="/residents/:id/edit" element={<ResidentDetailPage />} />
          </Route>

          {/* Directory - FE-23 (Management only) */}
          <Route element={<RoleRoute allowedRoles={MANAGEMENT_ROLES} />}>
            <Route path="/directory"                element={<DirectoryPage />} />
            <Route path="/directory/owners/:id"    element={<OwnerDetailPage />} />
            <Route path="/directory/tenants/:id"   element={<TenantDetailPage />} />
            <Route path="/directory/flat/:id"      element={<FlatDetailPage />} />
          </Route>

          {/* Complaints - FE-01, FE-02, FE-06, FE-07, FE-10, FE-13, FE-16, FE-20 */}
          <Route element={<RoleRoute allowedRoles={RESIDENT_ROLES} />}>
            <Route path="/complaints"          element={<ComplaintHistoryPage />} />
            <Route path="/complaints/new"      element={<ComplaintSubmissionPage />} />
            <Route path="/complaints/feedback" element={<FeedbackPage />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={COMPLAINT_ADMIN_ROLES} />}>
            <Route path="/complaints/assign"     element={<ComplaintAssignmentPage />} />
            <Route path="/complaints/monitoring" element={<ComplaintMonitoringPage />} />
            <Route path="/complaints/reports"    element={<ComplaintReportsPage />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={[...COMPLAINT_ADMIN_ROLES, ROLES.MAINTENANCE]} />}>
            <Route path="/complaints/progress" element={<ProgressUpdatePage />} />
          </Route>
          <Route element={<RoleRoute allowedRoles={COMPLAINT_VIEW_ROLES} />}>
            <Route path="/complaints/:id" element={<ComplaintTrackingPage />} />
          </Route>

          {/* Reports & Analytics - FE-36 */}
          <Route element={<RoleRoute allowedRoles={COMPLAINT_ADMIN_ROLES} />}>
            <Route path="/analytics" element={<AnalyticsDashboardPage />} />
          </Route>

          {/* Payments - FE-11. Bug 4: unlike Billing/Residents/Documents,
              this stays open to every role - the Dashboard's "Pay Bill"
              quick action and the Reminders flow send residents here to pay
              their own dues, so gating it to management would break bill
              payment for residents. */}
          <Route path="/payments"                       element={<PaymentDashboardPage />} />
          <Route path="/payments/pay/:billId"           element={<PayBillPage />} />
          <Route path="/payments/history"               element={<PaymentHistoryPage />} />
          <Route path="/payments/receipt/:paymentId"    element={<ReceiptPage />} />
          <Route path="/payments/success"               element={<PaymentSuccessPage />} />

          {/* Reminders - FE-12 */}
          <Route path="/reminders"     element={<RemindersPage />} />
          <Route path="/reminders/:id" element={<ReminderDetailPage />} />

          {/* Billing - FE-28. Bug 4: the billing ledger/generation tools are
              management-only, but a resident reaches their own invoice
              (with a Pay button) straight from a reminder, so that one leaf
              route stays open to everyone. */}
          <Route element={<RoleRoute allowedRoles={MANAGEMENT_ROLES} />}>
            <Route path="/billing"          element={<BillingDashboardPage />} />
            <Route path="/billing/generate" element={<GenerateBillPage />} />
          </Route>
          <Route path="/billing/invoice/:id" element={<InvoiceDetailPage />} />

          {/* Documents - FE-38. Bug 4: this is the society's document
              repository console (upload/delete require an admin role on
              the backend) - no resident-facing feature links into it. */}
          <Route element={<RoleRoute allowedRoles={MANAGEMENT_ROLES} />}>
            <Route path="/documents"        element={<DocumentManagementPage />} />
            <Route path="/documents/upload" element={<UploadDocumentPage />} />
            <Route path="/documents/:id"    element={<DocumentDetailPage />} />
          </Route>

          {/* Audit - FE-39/BE-39. Access is admin-only per the backend
              (backend/app/routers/audit.py requires the "admin" role
              specifically, not the broader management set). */}
          <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/audit"          element={<AuditLogsPage />} />
            <Route path="/audit/login"    element={<LoginLogsPage />} />
            <Route path="/audit/activity" element={<ActivityLogsPage />} />
          </Route>

          {/* Settings - FE-40. Bug 4: the hub and the personal settings pages
              (profile/notifications/security/appearance/about) stay open to
              everyone, but the society-wide config pages are management
              only. */}
          <Route path="/settings"                element={<SettingsDashboardPage />} />
          <Route path="/settings/profile"        element={<ProfileSettingsPage />} />
          <Route path="/settings/notifications"  element={<NotificationSettingsPage />} />
          <Route path="/settings/security"       element={<SecuritySettingsPage />} />
          <Route path="/settings/appearance"     element={<AppearanceSettingsPage />} />
          <Route element={<RoleRoute allowedRoles={MANAGEMENT_ROLES} />}>
            <Route path="/settings/apartment"    element={<ApartmentSettingsPage />} />
            <Route path="/settings/system"       element={<SystemSettingsPage />} />
          </Route>
          <Route path="/settings/about"          element={<AboutPage />} />

          {/* ── Communication - FE-03, 04, 08, 09, 19, 27, 29, 31, 34, 37 ── */}
          {/* FE-27: Hub */}
          <Route path="/communication"           element={<CommunicationPage />} />

          {/* FE-04 + FE-09: Announcements with search */}
          <Route path="/announcements"           element={<AnnouncementsPage />} />

          {/* FE-37: Notification Center */}
          <Route path="/notifications"           element={<NotificationCenterPage />} />

          {/* FE-08 and FE-19 are management screens - publishing a notice and
              broadcasting an emergency. They were reachable by any signed-in
              resident, so they are gated to the roles that own them. */}
          <Route element={<RoleRoute allowedRoles={COMMUNICATION_ADMIN_ROLES} />}>
            {/* FE-08: Create Announcement (President) */}
            <Route path="/communication/create"    element={<CreateAnnouncementPage />} />

            {/* FE-19: Emergency Alert (President) */}
            <Route path="/communication/emergency" element={<EmergencyAlertPage />} />
          </Route>

          {/* FE-29: Forum & Lost and Found */}
          <Route path="/forum"                   element={<ForumPage />} />

          {/* FE-31: Community Events */}
          <Route path="/events"                  element={<EventsPage />} />

          {/* FE-34: Community Corners */}
          <Route path="/corners"                 element={<CornersPage />} />
        </Route>
      </Route>

      {/* Public landing */}
      <Route path="/" element={<HomePage />} />

      {/* Public legal pages - Bug 11: linked from the About page's "View Terms"/"View Policy" */}
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

