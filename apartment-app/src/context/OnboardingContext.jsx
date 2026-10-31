import { createContext, useContext, useState } from "react";
import { mockApplications, APPLICATION_STATUS } from "../features/onboarding/mock/onboarding";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children, onApprove }) {
  const [applications, setApplications] = useState([...mockApplications]);

  const addApplication = (application) => {
    setApplications((prev) => [application, ...prev]);
  };

  const updateApplicationStatus = (id, status) => {
    setApplications((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (status === APPLICATION_STATUS.APPROVED && onApprove) {
          onApprove(a);
        }
        return { ...a, status };
      })
    );
  };

  return (
    <OnboardingContext.Provider value={{ applications, addApplication, updateApplicationStatus }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}
