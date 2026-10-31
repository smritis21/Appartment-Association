import { Box, Chip } from "@mui/material";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useEffect, useMemo, useState } from "react";
import { useResidents } from "../../../context/ResidentContext";
import { getAllPayments } from "../mock/payments";
import { fetchPaymentsByResident } from "../../../services/paymentService";
import { isOffline } from "../../../services/apiClient";
import { useAuth } from "../../../hooks/useAuth";
import PageHeader from "../../../components/common/PageHeader";
import PaymentHistory from "../components/PaymentHistory";
import EmptyState from "../../../components/common/EmptyState";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";

export default function PaymentHistoryPage() {
  const { residents } = useResidents();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [offline, setOffline] = useState(false);
  const [noResident, setNoResident] = useState(false);

  useEffect(() => {
    const residentId = user?.residentId ?? user?.resident_id ?? null;
    if (!residentId) {
      // No resident record linked to this account (e.g. staff/admin login,
      // or a demo account whose resident link is missing) - calling the API
      // with an empty id would just 404. Show an explanatory empty state
      // instead of a bare, unexplained "No Payments Found".
      setNoResident(true);
      setPayments([]);
      return;
    }
    setNoResident(false);
    fetchPaymentsByResident(residentId)
      .then((data) => { setPayments(data); setOffline(false); })
      .catch((err) => {
        if (isOffline(err)) {
          setPayments(getAllPayments());
          setOffline(true);
        }
      });
  }, [user]);

  const residentMap = useMemo(() => {
    const m = {};
    residents.forEach((r) => { m[r.id] = r; });
    return m;
  }, [residents]);

  return (
    <Box>
      <PageHeader
        title="Payment History"
        subtitle="Complete record of all payment transactions"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/payments" },
          { label: "History" },
        ]}
      />
      {noResident ? (
        <EmptyState
          icon={HistoryOutlinedIcon}
          title="No Resident Record Linked"
          description="This account isn't linked to a resident record, so there's no payment history to show. Contact your society admin if this looks wrong."
        />
      ) : (
        <PaymentHistory payments={payments} residentMap={residentMap} />
      )}
    </Box>
  );
}

