import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Avatar, Box, Button, Chip, CircularProgress, Grid, Paper, Tab, Tabs, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useResidents } from "../../../context/ResidentContext";
import { mockFlats } from "../mock/flats";
import { mockFamilyMembers } from "../../residents/mock/family";
import { ROLE_LABELS } from "../../auth/mock/roles";
import { formatDate } from "../../../utils/formatDate";
import {
  fetchDirectoryResident,
  fetchHousehold,
  fetchEmergencyContacts,
  fetchDirectoryFlats,
} from "../../../services/directoryService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import ResidentMiniCard from "../components/ResidentMiniCard";
import ResidentStatusChip from "../../residents/components/ResidentStatusChip";
import EmptyState from "../../../components/common/EmptyState";

function InfoRow({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value || "-"}</Typography>
    </Grid>
  );
}

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { residents } = useResidents();
  const [tab, setTab] = useState(0);

  const [apiTenant, setApiTenant] = useState(null);
  const [apiFamily, setApiFamily] = useState([]);
  const [apiEmergencyContact, setApiEmergencyContact] = useState(null);
  const [apiFlatRow, setApiFlatRow] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDirectoryResident(id)
      .then(async (resident) => {
        if (cancelled) return;
        setApiTenant(resident);
        setOffline(false);
        const [family, contacts, flats] = await Promise.allSettled([
          fetchHousehold(id),
          fetchEmergencyContacts(id),
          fetchDirectoryFlats({ block: resident.wing }),
        ]);
        if (cancelled) return;
        if (family.status === "fulfilled") setApiFamily(family.value);
        if (contacts.status === "fulfilled") setApiEmergencyContact(contacts.value[0] ?? null);
        if (flats.status === "fulfilled") {
          setApiFlatRow(flats.value.find((row) => row.flat.flat === resident.flat) ?? null);
        }
      })
      .catch((err) => { if (!cancelled && isOffline(err)) setOffline(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const mockTenant = residents.find((r) => r.id === id);
  const tenant = apiTenant ?? (offline ? mockTenant : null);

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!tenant) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">Tenant not found.</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate("/directory")}>Back to Directory</Button>
      </Box>
    );
  }

  const initials = tenant.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const family = apiTenant ? apiFamily : (mockFamilyMembers[tenant.id] ?? []);
  const emergencyContact = apiTenant ? apiEmergencyContact : tenant.emergencyContact;
  const rentedFlat = apiTenant
    ? (apiFlatRow ? { id: apiFlatRow.flat.id, wing: apiFlatRow.flat.wing, flat: apiFlatRow.flat.flat, floor: apiFlatRow.flat.floor } : null)
    : mockFlats.find((f) => f.tenantId === tenant.id) ?? null;
  const owner = apiTenant
    ? (apiFlatRow?.owner ?? null)
    : (rentedFlat?.ownerId ? residents.find((r) => r.id === rentedFlat.ownerId) : null);

  const leaseActive = tenant.leaseEnd && new Date(tenant.leaseEnd) >= new Date();

  return (
    <>
      <PageHeader
        title={tenant.name}
        subtitle={ROLE_LABELS[tenant.role] ?? tenant.role}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Directory", href: "/directory" },
          { label: tenant.name },
        ]}
        action={
          <Button startIcon={<ArrowBackOutlinedIcon />} variant="outlined" size="small" onClick={() => navigate("/directory")}>
            Back
          </Button>
        }
      />

      {/* Profile card */}
      <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        <Avatar sx={{ bgcolor: "secondary.main", width: 72, height: 72, fontSize: 24, fontWeight: 700 }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h6" fontWeight={700}>{tenant.name}</Typography>
          <Typography variant="body2" color="text.secondary">{tenant.email} · {tenant.phone}</Typography>
          <Typography variant="body2" color="text.secondary">{tenant.occupation}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip label={ROLE_LABELS[tenant.role] ?? tenant.role} color="secondary" size="small" />
          <ResidentStatusChip status={tenant.status} />
          <Chip
            label={leaseActive ? "Lease Active" : "Lease Expired"}
            color={leaseActive ? "success" : "error"}
            size="small"
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper elevation={1} sx={{ borderRadius: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: "1px solid", borderColor: "divider", px: 2 }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {["Information", "Rental Details", "Owner", "Family", "Emergency Contact"].map((l) => (
            <Tab key={l} label={l} sx={{ fontSize: 13, fontWeight: 600, textTransform: "none" }} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <Grid container spacing={2}>
              <InfoRow label="Full Name"    value={tenant.name} />
              <InfoRow label="Email"        value={tenant.email} />
              <InfoRow label="Phone"        value={tenant.phone} />
              <InfoRow label="Occupation"   value={tenant.occupation} />
              <InfoRow label="Wing"         value={tenant.wing} />
              <InfoRow label="Flat"         value={tenant.flat} />
              <InfoRow label="Move-in Date" value={formatDate(tenant.moveInDate)} />
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                <ResidentStatusChip status={tenant.status} />
              </Grid>
            </Grid>
          )}

          {tab === 1 && (
            <Grid container spacing={2}>
              <InfoRow label="Owner Name"   value={tenant.ownerName} />
              <InfoRow label="Lease Start"  value={formatDate(tenant.leaseStart)} />
              <InfoRow label="Lease End"    value={formatDate(tenant.leaseEnd)} />
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">Lease Status</Typography>
                <Chip
                  label={leaseActive ? "Active" : "Expired"}
                  color={leaseActive ? "success" : "error"}
                  size="small"
                />
              </Grid>
              {rentedFlat && (
                <>
                  <InfoRow label="Flat"  value={`Wing ${rentedFlat.wing} · ${rentedFlat.flat}`} />
                  <InfoRow label="Floor" value={rentedFlat.floor} />
                </>
              )}
            </Grid>
          )}

          {tab === 2 && (
            owner ? (
              <ResidentMiniCard resident={owner} label="Property Owner" />
            ) : (
              <Typography variant="body2" color="text.secondary">Owner information not available.</Typography>
            )
          )}

          {tab === 3 && (
            family.length === 0 ? (
              <EmptyState
                icon={PeopleOutlinedIcon}
                title="No Family Members"
                description="No family members have been recorded for this tenant."
              />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {family.map((m) => (
                  <Paper key={m.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.relation}{m.age != null ? ` · Age ${m.age}` : ""}
                        </Typography>
                      </Box>
                      {m.phone && <Typography variant="caption" color="text.secondary">{m.phone}</Typography>}
                    </Box>
                  </Paper>
                ))}
              </Box>
            )
          )}

          {tab === 4 && (
            emergencyContact ? (
              <Grid container spacing={2}>
                <InfoRow label="Name"     value={emergencyContact.name} />
                <InfoRow label="Relation" value={emergencyContact.relation} />
                <InfoRow label="Phone"    value={emergencyContact.phone} />
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">No emergency contact on record.</Typography>
            )
          )}
        </Box>
      </Paper>
    </>
  );
}

