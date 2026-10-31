import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Avatar, Box, Button, Chip, CircularProgress, Grid, Paper, Tab, Tabs, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
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
import FlatStatusChip from "../components/FlatStatusChip";
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

export default function OwnerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { residents } = useResidents();
  const [tab, setTab] = useState(0);

  const [apiOwner, setApiOwner] = useState(null);
  const [apiFamily, setApiFamily] = useState([]);
  const [apiEmergencyContact, setApiEmergencyContact] = useState(null);
  const [apiOwnedFlats, setApiOwnedFlats] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDirectoryResident(id)
      .then(async (resident) => {
        if (cancelled) return;
        setApiOwner(resident);
        setOffline(false);
        const [family, contacts, flats] = await Promise.allSettled([
          fetchHousehold(id),
          fetchEmergencyContacts(id),
          fetchDirectoryFlats({ block: resident.wing, ownershipType: "owned" }),
        ]);
        if (cancelled) return;
        if (family.status === "fulfilled") setApiFamily(family.value);
        if (contacts.status === "fulfilled") setApiEmergencyContact(contacts.value[0] ?? null);
        if (flats.status === "fulfilled") {
          // fetchDirectoryFlats only filters by block+ownership, which
          // returns every owned flat in the block - narrow to flats this
          // resident is actually listed against, not just neighbours'.
          setApiOwnedFlats(flats.value.filter((row) => row.residents.some((r) => r.id === id)));
        }
      })
      .catch((err) => { if (!cancelled && isOffline(err)) setOffline(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const mockOwner = residents.find((r) => r.id === id);
  const owner = apiOwner ?? (offline ? mockOwner : null);

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!owner) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">Owner not found.</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate("/directory")}>Back to Directory</Button>
      </Box>
    );
  }

  const initials = owner.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const ownedFlats = apiOwner
    ? (apiOwnedFlats ?? []).map((row) => ({
        id: row.flat.id, wing: row.flat.wing, flat: row.flat.flat, status: row.flat.status,
        tenant: row.tenant,
      }))
    : mockFlats.filter((f) => f.ownerId === owner.id || (f.wing === owner.wing && f.flat === owner.flat));
  const family = apiOwner ? apiFamily : (mockFamilyMembers[owner.id] ?? []);
  const emergencyContact = apiOwner ? apiEmergencyContact : owner.emergencyContact;

  return (
    <>
      <PageHeader
        title={owner.name}
        subtitle={ROLE_LABELS[owner.role] ?? owner.role}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Directory", href: "/directory" },
          { label: owner.name },
        ]}
        action={
          <Button startIcon={<ArrowBackOutlinedIcon />} variant="outlined" size="small" onClick={() => navigate("/directory")}>
            Back
          </Button>
        }
      />

      {/* Profile card */}
      <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3, display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 72, height: 72, fontSize: 24, fontWeight: 700 }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h6" fontWeight={700}>{owner.name}</Typography>
          <Typography variant="body2" color="text.secondary">{owner.email} · {owner.phone}</Typography>
          <Typography variant="body2" color="text.secondary">{owner.occupation}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip label={ROLE_LABELS[owner.role] ?? owner.role} color="primary" size="small" />
          <ResidentStatusChip status={owner.status} />
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
          {["Information", "Owned Flats", "Family", "Emergency Contact"].map((l) => (
            <Tab key={l} label={l} sx={{ fontSize: 13, fontWeight: 600, textTransform: "none" }} />
          ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 && (
            <Grid container spacing={2}>
              <InfoRow label="Full Name"    value={owner.name} />
              <InfoRow label="Email"        value={owner.email} />
              <InfoRow label="Phone"        value={owner.phone} />
              <InfoRow label="Occupation"   value={owner.occupation} />
              <InfoRow label="Wing"         value={owner.wing} />
              <InfoRow label="Flat"         value={owner.flat} />
              <InfoRow label="Move-in Date" value={formatDate(owner.moveInDate)} />
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                <ResidentStatusChip status={owner.status} />
              </Grid>
            </Grid>
          )}

          {tab === 1 && (
            ownedFlats.length === 0 ? (
              <EmptyState
                icon={HomeOutlinedIcon}
                title="No Flats Registered"
                description="No flats are currently registered under this owner."
              />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {ownedFlats.map((flat) => {
                  const tenant = flat.tenant ?? (flat.tenantId ? residents.find((r) => r.id === flat.tenantId) : null);
                  return (
                    <Paper key={flat.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <HomeOutlinedIcon sx={{ color: "primary.main", fontSize: 18 }} />
                          <Typography variant="body2" fontWeight={700}>Wing {flat.wing} · {flat.flat}</Typography>
                        </Box>
                        <FlatStatusChip status={flat.status} />
                      </Box>
                      {tenant && <ResidentMiniCard resident={tenant} label="Current Tenant" />}
                      {!tenant && (
                        <Typography variant="caption" color="text.secondary">No tenant assigned.</Typography>
                      )}
                      <Button
                        size="small"
                        variant="text"
                        sx={{ mt: 1 }}
                        onClick={() => navigate(`/directory/flat/${flat.id}`)}
                      >
                        View Flat Details
                      </Button>
                    </Paper>
                  );
                })}
              </Box>
            )
          )}

          {tab === 2 && (
            family.length === 0 ? (
              <EmptyState
                icon={PeopleOutlinedIcon}
                title="No Family Members"
                description="No family members have been recorded for this owner."
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

          {tab === 3 && (
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

