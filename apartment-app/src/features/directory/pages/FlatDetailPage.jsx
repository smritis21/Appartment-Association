import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useResidents } from "../../../context/ResidentContext";
import { mockFlats, getFlatById } from "../mock/flats";
import { mockHouseholds } from "../mock/households";
import { buildDynamicRows } from "../mock/directory";
import { fetchDirectoryFlat, fetchHousehold } from "../../../services/directoryService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import FlatDetails from "../components/FlatDetails";

export default function FlatDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { residents } = useResidents();

  const [apiRow, setApiRow] = useState(null);
  const [family, setFamily] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDirectoryFlat(id)
      .then(async (row) => {
        if (cancelled) return;
        setApiRow(row);
        setOffline(false);
        const target = row.owner ?? row.tenant;
        if (target) {
          try {
            const members = await fetchHousehold(target.id);
            if (!cancelled) setFamily(members);
          } catch {
            // Best-effort - leave family as null so FlatDetails falls back gracefully.
          }
        }
      })
      .catch((err) => { if (!cancelled && isOffline(err)) setOffline(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Try static flat first
  let flat = getFlatById(id);
  let owner = null, tenant = null, household = null;

  if (flat) {
    // Resolve by wing+flat first (catches newly approved residents), then fall back to static ID
    const byFlat = residents.filter((r) => r.wing === flat.wing && r.flat === flat.flat);
    owner  = byFlat.find((r) => r.role === "owner")  ?? (flat.ownerId  ? residents.find((r) => r.id === flat.ownerId)  ?? null : null);
    tenant = byFlat.find((r) => r.role === "tenant") ?? (flat.tenantId ? residents.find((r) => r.id === flat.tenantId) ?? null : null);
    household = flat.householdId ? mockHouseholds.find((h) => h.id === flat.householdId) ?? null : null;
  } else {
    // Fall back to dynamic rows (newly approved residents not in mockFlats)
    const dynamicRows = buildDynamicRows(mockFlats, residents);
    const row = dynamicRows.find((r) => r.flat.id === id);
    if (row) { flat = row.flat; owner = row.owner; tenant = row.tenant; }
  }

  // Live data takes over once it lands; the mock lookup above only backs
  // the brief loading window and the offline fallback.
  if (apiRow) {
    flat = apiRow.flat;
    owner = apiRow.owner;
    tenant = apiRow.tenant;
  }

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!flat) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">Flat not found.</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate("/directory")}>Back to Directory</Button>
      </Box>
    );
  }

  return (
    <>
      <PageHeader
        title={`Wing ${flat.wing} · Flat ${flat.flat}`}
        subtitle={`Floor ${flat.floor} · ${flat.id}`}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Directory", href: "/directory" },
          { label: `${flat.wing}-${flat.flat}` },
        ]}
        action={
          <Button
            startIcon={<ArrowBackOutlinedIcon />}
            variant="outlined"
            size="small"
            onClick={() => navigate("/directory")}
          >
            Back
          </Button>
        }
      />
      <FlatDetails flat={flat} owner={owner} tenant={tenant} household={household} family={family} />
    </>
  );
}

