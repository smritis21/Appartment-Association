// Reminder mock data - references billId and residentId from billing/payments mock.
// No bill data is duplicated here; all bill details are joined at runtime.

export const REMINDER_TYPE = {
  UPCOMING:          "upcoming",
  DUE_TODAY:         "due_today",
  OVERDUE:           "overdue",
  PAYMENT_RECEIVED:  "payment_received",
  FINAL_REMINDER:    "final_reminder",
};

export const REMINDER_STATUS = {
  UNREAD:    "unread",
  READ:      "read",
  DISMISSED: "dismissed",
};

export const REMINDER_PRIORITY = {
  LOW:      "low",
  MEDIUM:   "medium",
  HIGH:     "high",
  CRITICAL: "critical",
};

export const mockReminders = [
  {
    id: "REM-001",
    type: REMINDER_TYPE.OVERDUE,
    priority: REMINDER_PRIORITY.CRITICAL,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-005",
    residentId: "RES-005",
    title: "Overdue Payment - April 2026",
    description: "Maintenance bill for Wing E, Flat 505 is overdue. Immediate payment required to avoid penalty.",
    sentAt: "2026-04-16T09:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-002",
    type: REMINDER_TYPE.OVERDUE,
    priority: REMINDER_PRIORITY.CRITICAL,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-007",
    residentId: "RES-007",
    title: "Overdue Payment - April 2026",
    description: "Maintenance bill for Wing G, Flat 702 is overdue. Please clear dues immediately.",
    sentAt: "2026-04-16T09:05:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-003",
    type: REMINDER_TYPE.OVERDUE,
    priority: REMINDER_PRIORITY.HIGH,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-014",
    residentId: "RES-004",
    title: "Overdue Payment - May 2026",
    description: "May 2026 maintenance bill for Wing D, Flat 402 is overdue. Please pay at the earliest.",
    sentAt: "2026-05-16T09:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-004",
    type: REMINDER_TYPE.FINAL_REMINDER,
    priority: REMINDER_PRIORITY.CRITICAL,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-005",
    residentId: "RES-005",
    title: "Final Reminder - April 2026 Bill",
    description: "This is your final reminder. Failure to pay will result in a late fee being added to your next bill.",
    sentAt: "2026-04-20T10:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-005",
    type: REMINDER_TYPE.FINAL_REMINDER,
    priority: REMINDER_PRIORITY.HIGH,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-007",
    residentId: "RES-007",
    title: "Final Reminder - April 2026 Bill",
    description: "Final notice: Your April 2026 maintenance bill remains unpaid. Please settle immediately.",
    sentAt: "2026-04-21T10:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-006",
    type: REMINDER_TYPE.UPCOMING,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-012",
    residentId: "RES-002",
    title: "Upcoming Payment - May 2026",
    description: "Your May 2026 maintenance bill is due on 15 May 2026. Please ensure timely payment.",
    sentAt: "2026-05-10T08:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-007",
    type: REMINDER_TYPE.UPCOMING,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-015",
    residentId: "RES-005",
    title: "Upcoming Payment - May 2026",
    description: "Your May 2026 maintenance bill is due on 15 May 2026. Pay early to avoid late fees.",
    sentAt: "2026-05-10T08:05:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-008",
    type: REMINDER_TYPE.UPCOMING,
    priority: REMINDER_PRIORITY.MEDIUM,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-019",
    residentId: "RES-014",
    title: "Upcoming Payment - May 2026",
    description: "Maintenance bill for Wing F, Flat 603 is due in 5 days. Please plan your payment.",
    sentAt: "2026-05-10T08:10:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-009",
    type: REMINDER_TYPE.DUE_TODAY,
    priority: REMINDER_PRIORITY.HIGH,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-004",
    residentId: "RES-004",
    title: "Bill Due Today - April 2026",
    description: "Your April 2026 maintenance bill is due today. Pay now to avoid overdue charges.",
    sentAt: "2026-04-15T07:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-010",
    type: REMINDER_TYPE.DUE_TODAY,
    priority: REMINDER_PRIORITY.HIGH,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-009",
    residentId: "RES-009",
    title: "Bill Due Today - April 2026",
    description: "Your April 2026 maintenance bill is due today. Please make the payment before midnight.",
    sentAt: "2026-04-15T07:05:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-011",
    type: REMINDER_TYPE.PAYMENT_RECEIVED,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-001",
    residentId: "RES-001",
    title: "Payment Received - April 2026",
    description: "Your payment of ₹4,796 for April 2026 has been received successfully. Thank you!",
    sentAt: "2026-04-10T10:30:00",
    suggestedAction: "view_receipt",
  },
  {
    id: "REM-012",
    type: REMINDER_TYPE.PAYMENT_RECEIVED,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-002",
    residentId: "RES-002",
    title: "Payment Received - April 2026",
    description: "Your payment of ₹4,207 for April 2026 has been received. Receipt is available for download.",
    sentAt: "2026-04-12T14:10:00",
    suggestedAction: "view_receipt",
  },
  {
    id: "REM-013",
    type: REMINDER_TYPE.PAYMENT_RECEIVED,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.DISMISSED,
    billId: "BILL-2026-006",
    residentId: "RES-006",
    title: "Payment Received - April 2026",
    description: "Payment of ₹5,772 for April 2026 confirmed. Your account is up to date.",
    sentAt: "2026-04-08T11:35:00",
    suggestedAction: "view_receipt",
  },
  {
    id: "REM-014",
    type: REMINDER_TYPE.PAYMENT_RECEIVED,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.DISMISSED,
    billId: "BILL-2026-011",
    residentId: "RES-001",
    title: "Payment Received - May 2026",
    description: "Your May 2026 payment of ₹4,821 has been received. Thank you for paying on time!",
    sentAt: "2026-05-09T12:15:00",
    suggestedAction: "view_receipt",
  },
  {
    id: "REM-015",
    type: REMINDER_TYPE.PAYMENT_RECEIVED,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-016",
    residentId: "RES-006",
    title: "Payment Received - May 2026",
    description: "Cash payment of ₹5,237 for May 2026 has been recorded. Receipt available at the office.",
    sentAt: "2026-05-07T15:35:00",
    suggestedAction: "view_receipt",
  },
  {
    id: "REM-016",
    type: REMINDER_TYPE.UPCOMING,
    priority: REMINDER_PRIORITY.MEDIUM,
    status: REMINDER_STATUS.DISMISSED,
    billId: "BILL-2026-004",
    residentId: "RES-004",
    title: "Upcoming Payment - April 2026",
    description: "Reminder: Your April 2026 bill is due in 3 days. Please arrange payment.",
    sentAt: "2026-04-12T08:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-017",
    type: REMINDER_TYPE.OVERDUE,
    priority: REMINDER_PRIORITY.HIGH,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-004",
    residentId: "RES-004",
    title: "Overdue Payment - April 2026",
    description: "Your April 2026 bill remains unpaid and is now overdue. Please pay immediately.",
    sentAt: "2026-04-18T09:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-018",
    type: REMINDER_TYPE.DUE_TODAY,
    priority: REMINDER_PRIORITY.HIGH,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-012",
    residentId: "RES-002",
    title: "Bill Due Today - May 2026",
    description: "May 2026 maintenance bill for Wing B, Flat 204 is due today. Pay now to stay current.",
    sentAt: "2026-05-15T07:00:00",
    suggestedAction: "pay_now",
  },
  {
    id: "REM-019",
    type: REMINDER_TYPE.PAYMENT_RECEIVED,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.READ,
    billId: "BILL-2026-018",
    residentId: "RES-012",
    title: "Payment Received - May 2026",
    description: "Your May 2026 payment of ₹4,796 has been received successfully. Thank you!",
    sentAt: "2026-05-12T13:50:00",
    suggestedAction: "view_receipt",
  },
  {
    id: "REM-020",
    type: REMINDER_TYPE.UPCOMING,
    priority: REMINDER_PRIORITY.LOW,
    status: REMINDER_STATUS.UNREAD,
    billId: "BILL-2026-017",
    residentId: "RES-011",
    title: "Partial Payment - Balance Due",
    description: "A partial payment was recorded for your May 2026 bill. Please clear the remaining balance before the due date.",
    sentAt: "2026-05-11T09:00:00",
    suggestedAction: "pay_now",
  },
];

// Runtime state - dismissed/read mutations stored here
const _state = {};

export function getReminderState(id) {
  return _state[id] ?? null;
}

export function setReminderState(id, status) {
  _state[id] = status;
}

export function getAllReminders() {
  return mockReminders.map((r) => ({
    ...r,
    status: _state[r.id] ?? r.status,
  }));
}

export function getReminderById(id) {
  const r = mockReminders.find((r) => r.id === id) ?? null;
  if (!r) return null;
  return { ...r, status: _state[r.id] ?? r.status };
}

export function getReminderStats() {
  const reminders = getAllReminders();
  return {
    unread:    reminders.filter((r) => r.status === REMINDER_STATUS.UNREAD).length,
    dueToday:  reminders.filter((r) => r.type === REMINDER_TYPE.DUE_TODAY).length,
    upcoming:  reminders.filter((r) => r.type === REMINDER_TYPE.UPCOMING).length,
    overdue:   reminders.filter((r) => r.type === REMINDER_TYPE.OVERDUE || r.type === REMINDER_TYPE.FINAL_REMINDER).length,
    completed: reminders.filter((r) => r.type === REMINDER_TYPE.PAYMENT_RECEIVED).length,
    dismissed: reminders.filter((r) => r.status === REMINDER_STATUS.DISMISSED).length,
  };
}

// Returns the single highest-priority unread/read reminder for the banner
export function getTopReminder() {
  const ORDER = {
    [REMINDER_PRIORITY.CRITICAL]: 0,
    [REMINDER_PRIORITY.HIGH]:     1,
    [REMINDER_PRIORITY.MEDIUM]:   2,
    [REMINDER_PRIORITY.LOW]:      3,
  };
  return getAllReminders()
    .filter((r) => r.status !== REMINDER_STATUS.DISMISSED)
    .sort((a, b) => ORDER[a.priority] - ORDER[b.priority])[0] ?? null;
}

