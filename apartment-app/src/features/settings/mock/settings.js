import appConfig from "../../../config/appConfig";

// ── Notification defaults ─────────────────────────────────────────────────────
export const defaultNotifications = {
  paymentReminders:        true,
  complaintUpdates:        true,
  visitorAlerts:           false,
  announcements:           true,
  maintenanceNotifications:true,
  communityPosts:          false,
  emailNotifications:      true,
  smsNotifications:        false,
  pushNotifications:       true,
  weeklySummary:           true,
  monthlySummary:          false,
};

// ── Appearance defaults ───────────────────────────────────────────────────────
export const defaultAppearance = {
  theme:       "light",       // light | dark | system
  accentColor: "green",       // blue | green | purple | orange
  fontSize:    "medium",      // small | medium | large
  density:     "comfortable", // comfortable | compact
  language:    "en",          // en | ta | hi
};

// ── Apartment configuration ───────────────────────────────────────────────────
export const defaultApartment = {
  name:                      appConfig.appName,
  shortName:                 appConfig.appShortName,
  wings:                     8,
  floors:                    8,
  totalFlats:                256,
  maintenanceDueDay:         15,
  lateFeePercentage:         5,
  visitorParkingEnabled:     true,
  communityHallBooking:      true,
  complaintEscalation:       true,
  address:                   "123, Jains Kences Retreat, Bengaluru, Karnataka 560001",
  contactEmail:              "admin@jkr.com",
  contactPhone:              "9876543214",
};

// ── System preferences ────────────────────────────────────────────────────────
export const defaultSystem = {
  appName:           appConfig.appName,
  version:           appConfig.version,
  timezone:          "Asia/Kolkata",
  currency:          "INR",
  dateFormat:        "DD MMM YYYY",
  backupFrequency:   "daily",   // daily | weekly | monthly
  autoArchiveLogs:   true,
  enableAuditLogging:true,
  enableEmailService:true,
  enableSmsService:  false,
};

// ── Security mock data ────────────────────────────────────────────────────────
export const mockActiveSessions = [
  { id: "s1", device: "Desktop",  browser: "Chrome 124",       ip: "192.168.1.10", location: "Bengaluru, IN", lastActive: "2026-05-15T08:02:11", current: true  },
  { id: "s2", device: "Mobile",   browser: "Chrome Mobile 124",ip: "10.0.0.77",    location: "Bengaluru, IN", lastActive: "2026-05-14T19:30:00", current: false },
  { id: "s3", device: "Laptop",   browser: "Firefox 125",      ip: "192.168.1.22", location: "Bengaluru, IN", lastActive: "2026-05-13T14:00:00", current: false },
];

export const mockLoginHistory = [
  { id: "lh1", action: "Login",  device: "Desktop", browser: "Chrome 124",        ip: "192.168.1.10", timestamp: "2026-05-15T08:02:11", status: "Success" },
  { id: "lh2", action: "Login",  device: "Mobile",  browser: "Chrome Mobile 124", ip: "10.0.0.77",    timestamp: "2026-05-14T07:15:00", status: "Success" },
  { id: "lh3", action: "Login",  device: "Laptop",  browser: "Firefox 125",       ip: "192.168.1.22", timestamp: "2026-05-13T09:00:00", status: "Success" },
  { id: "lh4", action: "Login",  device: "Mobile",  browser: "Safari 17",         ip: "203.0.113.45", timestamp: "2026-05-12T22:10:00", status: "Failed"  },
  { id: "lh5", action: "Logout", device: "Desktop", browser: "Chrome 124",        ip: "192.168.1.10", timestamp: "2026-05-11T18:00:00", status: "Success" },
];

export const mockTrustedDevices = [
  { id: "td1", device: "Desktop",  browser: "Chrome 124",        addedOn: "2026-04-01" },
  { id: "td2", device: "Laptop",   browser: "Firefox 125",       addedOn: "2026-04-15" },
];

// ── Settings nav items (used by dashboard + search) ───────────────────────────
export const SETTINGS_NAV = [
  { label: "Profile",       subtitle: "Name, email, phone, flat details",          path: "/settings/profile",       icon: "PersonOutlined",       keywords: ["profile","name","email","phone","flat","wing","emergency"] },
  { label: "Notifications", subtitle: "Reminders, alerts, email, SMS, push",       path: "/settings/notifications", icon: "NotificationsOutlined", keywords: ["notification","reminder","alert","email","sms","push","summary"] },
  { label: "Security",      subtitle: "Password, sessions, 2FA, login history",    path: "/settings/security",      icon: "LockOutlined",          keywords: ["security","password","2fa","session","login","device","trusted"] },
  { label: "Appearance",    subtitle: "Theme, accent color, font size, density",   path: "/settings/appearance",    icon: "PaletteOutlined",       keywords: ["appearance","theme","dark","light","color","font","density","language"] },
  { label: "Apartment",     subtitle: "Name, wings, floors, fees, features",       path: "/settings/apartment",     icon: "ApartmentOutlined",     keywords: ["apartment","wing","floor","flat","maintenance","fee","parking","hall","complaint"] },
  { label: "System",        subtitle: "Timezone, currency, backup, services",      path: "/settings/system",        icon: "SettingsOutlined",      keywords: ["system","timezone","currency","date","backup","audit","email","sms","service"] },
  { label: "About",         subtitle: "Version, developer info, legal",            path: "/settings/about",         icon: "InfoOutlined",          keywords: ["about","version","react","mui","developer","copyright","terms","privacy"] },
];
