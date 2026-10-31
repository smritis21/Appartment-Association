import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const showToast = useCallback((message, severity = "info") => {
    setToast({ open: true, message, severity });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  return { toast, showToast, hideToast };
}
