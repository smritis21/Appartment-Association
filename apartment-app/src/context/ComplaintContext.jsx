import { createContext, useContext, useState } from "react";
import {
  mockComplaints,
  COMPLAINT_STATUS,
  STATUS_ORDER,
  getStaffById,
} from "../features/complaints/mock/complaints";

const ComplaintContext = createContext(null);

let complaintCounter = mockComplaints.length;

export function ComplaintProvider({ children }) {
  const [complaints, setComplaints] = useState([...mockComplaints]);

  // FE-01 - submit a new complaint; returns the generated mock ID.
  const addComplaint = ({ category, description, location, image, user }) => {
    complaintCounter += 1;
    const id = `CMP-2026-${String(complaintCounter).padStart(3, "0")}`;
    const now = new Date().toISOString();
    const complaint = {
      id,
      userId: user?.id ?? null,
      residentName: user?.name ?? "Resident",
      flat: user?.flat ?? "-",
      category,
      description,
      location,
      image: image ?? null,
      status: COMPLAINT_STATUS.SUBMITTED,
      assignedTo: null,
      createdAt: now,
      timeline: [
        { status: COMPLAINT_STATUS.SUBMITTED, at: now, by: user?.name ?? "Resident", notes: "Complaint submitted" },
      ],
      feedback: null,
    };
    setComplaints((prev) => [complaint, ...prev]);
    return complaint;
  };

  // FE-06 - assign (or reassign) a complaint to a staff member.
  const assignComplaint = (id, staffId, byName = "Admin") => {
    const staff = getStaffById(staffId);
    if (!staff) return;
    const now = new Date().toISOString();
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const status =
          c.status === COMPLAINT_STATUS.SUBMITTED ? COMPLAINT_STATUS.ASSIGNED : c.status;
        return {
          ...c,
          status,
          assignedTo: staffId,
          timeline: [
            ...c.timeline,
            { status: COMPLAINT_STATUS.ASSIGNED, at: now, by: byName, notes: `Assigned to ${staff.name}` },
          ],
        };
      })
    );
  };

  // FE-16 - staff progress update; only forward transitions are allowed.
  const updateProgress = (id, newStatus, notes, byName = "Staff") => {
    const now = new Date().toISOString();
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (STATUS_ORDER.indexOf(newStatus) <= STATUS_ORDER.indexOf(c.status)) return c;
        return {
          ...c,
          status: newStatus,
          timeline: [
            ...c.timeline,
            { status: newStatus, at: now, by: byName, notes: notes || "Status updated" },
          ],
        };
      })
    );
  };

  // FE-20 - feedback on resolved/closed complaints.
  const addFeedback = (id, rating, comment) => {
    const now = new Date().toISOString();
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, feedback: { rating, comment, submittedAt: now } }
          : c
      )
    );
  };

  const getComplaintById = (id) => complaints.find((c) => c.id === id) ?? null;

  return (
    <ComplaintContext.Provider
      value={{ complaints, addComplaint, assignComplaint, updateProgress, addFeedback, getComplaintById }}
    >
      {children}
    </ComplaintContext.Provider>
  );
}

export function useComplaints() {
  const ctx = useContext(ComplaintContext);
  if (!ctx) throw new Error("useComplaints must be used within ComplaintProvider");
  return ctx;
}

