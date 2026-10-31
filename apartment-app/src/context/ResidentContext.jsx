import { createContext, useContext, useState } from "react";
import { mockResidents, RESIDENT_STATUS } from "../features/residents/mock/residents";

const ResidentContext = createContext(null);

function applicationToResident(app) {
  return {
    id: `RES-${String(Date.now()).slice(-5)}`,
    appId: app.id,
    name: app.name,
    firstName: app.firstName,
    lastName: app.lastName,
    email: app.email,
    phone: app.phone,
    wing: app.wing,
    flat: app.flat,
    role: app.role,
    occupation: app.occupation ?? "",
    status: RESIDENT_STATUS.ACTIVE,
    moveInDate: new Date().toISOString().split("T")[0],
    moveOutDate: null,
    emergencyContact: { name: "", relation: "", phone: "" },
    documents: app.documents ?? [],
    ownerName: app.ownerName ?? null,
    leaseStart: app.leaseStart ?? null,
    leaseEnd: app.leaseEnd ?? null,
  };
}

export function ResidentProvider({ children }) {
  const [residents, setResidents] = useState([...mockResidents]);

  const addResident = (residentOrApp) => {
    // Accept either a full resident object or an onboarding application
    const resident = residentOrApp.appId !== undefined
      ? residentOrApp
      : applicationToResident(residentOrApp);

    // Prevent duplicates from same application
    setResidents((prev) => {
      if (resident.appId && prev.some((r) => r.appId === resident.appId)) return prev;
      return [resident, ...prev];
    });
  };

  const updateResident = (id, updates) => {
    setResidents((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const deactivateResident = (id, reason = "") => {
    setResidents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: RESIDENT_STATUS.INACTIVE, deactivationReason: reason } : r))
    );
  };

  const deleteResident = (id) => {
    setResidents((prev) => prev.filter((r) => r.id !== id));
  };

  const getResidentById = (id) => residents.find((r) => r.id === id) ?? null;

  return (
    <ResidentContext.Provider
      value={{ residents, addResident, updateResident, deactivateResident, deleteResident, getResidentById }}
    >
      {children}
    </ResidentContext.Provider>
  );
}

export function useResidents() {
  const ctx = useContext(ResidentContext);
  if (!ctx) throw new Error("useResidents must be used inside ResidentProvider");
  return ctx;
}
