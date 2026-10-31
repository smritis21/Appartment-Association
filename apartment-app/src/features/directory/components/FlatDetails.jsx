import {
  Box, Chip, Grid, Paper, Tab, Tabs, Typography,
} from "@mui/material";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import { useState } from "react";
import { formatDate } from "../../../utils/formatDate";
import { mockFamilyMembers } from "../../residents/mock/family";
import ResidentMiniCard from "./ResidentMiniCard";
import FlatStatusChip from "./FlatStatusChip";
import EmptyState from "../../../components/common/EmptyState";

const MOCK_FLAT_TIMELINE = [
  { event: "Flat Registered",       date: "2025-01-01", note: "Flat added to the system." },
  { event: "Owner Assigned",        date: "2025-06-15", note: "Owner registered and assigned." },
  { event: "Tenant Move-in",        date: "2026-02-01", note: "Tenant moved in." },
  { event: "Last Maintenance",      date: "2026-03-10", note: "Routine maintenance completed." },
];

function InfoRow({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value || "-"}</Typography>
    </Grid>
  );
}

export default function FlatDetails({ flat, owner, tenant, household, family }) {
  const [tab, setTab] = useState(0);

  // `family` is passed in (from live GET /directory/household/{id}) once the
  // flat is wired to the API; fall back to the demo lookup otherwise.
  let allFamily = family;
  if (!allFamily) {
    const ownerFamily  = owner  ? (mockFamilyMembers[owner.id]  ?? []) : [];
    const tenantFamily = tenant ? (mockFamilyMembers[tenant.id] ?? []) : [];
    allFamily = [...ownerFamily, ...tenantFamily];
  }

  return (
    <Paper elevation={1} sx={{ borderRadius: 3 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: "1px solid", borderColor: "divider", px: 2 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {["Flat Info", "Residents", "Family", "Maintenance", "Documents", "Timeline"].map((l) => (
          <Tab key={l} label={l} sx={{ fontSize: 13, fontWeight: 600, textTransform: "none" }} />
        ))}
      </Tabs>

      <Box sx={{ p: 3 }}>
        {/* Tab 0: Flat Info */}
        {tab === 0 && (
          <Grid container spacing={2}>
            <InfoRow label="Flat ID"  value={flat.id} />
            <InfoRow label="Wing"     value={flat.wing} />
            <InfoRow label="Flat No." value={flat.flat} />
            <InfoRow label="Floor"    value={flat.floor} />
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <FlatStatusChip status={flat.status} />
            </Grid>
            <InfoRow label="Household ID" value={flat.householdId ?? "-"} />
            <InfoRow label="Members"      value={household?.memberCount ?? "-"} />
          </Grid>
        )}

        {/* Tab 1: Residents */}
        {tab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {owner  ? <ResidentMiniCard resident={owner}  label="Owner"  /> : (
              <Typography variant="body2" color="text.secondary">No owner assigned.</Typography>
            )}
            {tenant ? <ResidentMiniCard resident={tenant} label="Tenant" /> : (
              <Typography variant="body2" color="text.secondary">No tenant assigned.</Typography>
            )}
          </Box>
        )}

        {/* Tab 2: Family */}
        {tab === 2 && (
          allFamily.length === 0 ? (
            <EmptyState
              icon={PeopleOutlinedIcon}
              title="No Family Members"
              description="No family members have been recorded for this household."
            />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {allFamily.map((m) => (
                <Paper key={m.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.relation}{m.age != null ? ` · Age ${m.age}` : ""}
                      </Typography>
                    </Box>
                    {m.phone && (
                      <Typography variant="caption" color="text.secondary">{m.phone}</Typography>
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
          )
        )}

        {/* Tab 3: Maintenance */}
        {tab === 3 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2,
              border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
              <BuildOutlinedIcon sx={{ color: "info.main" }} />
              <Box>
                <Typography variant="body2" fontWeight={600}>Maintenance Status</Typography>
                <Typography variant="caption" color="text.secondary">
                  {flat.status === "maintenance" ? "Currently under maintenance." : "No active maintenance requests."}
                </Typography>
              </Box>
              <Chip label={flat.status === "maintenance" ? "Active" : "Clear"} color={flat.status === "maintenance" ? "info" : "success"} size="small" sx={{ ml: "auto" }} />
            </Box>
          </Box>
        )}

        {/* Tab 4: Documents */}
        {tab === 4 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {(owner?.documents ?? []).length === 0 && (tenant?.documents ?? []).length === 0 ? (
              <EmptyState
                icon={FolderOpenOutlinedIcon}
                title="No Documents"
                description="No documents are on record for this flat."
              />
            ) : (
              [...(owner?.documents ?? []), ...(tenant?.documents ?? [])].map((doc) => (
                <Box key={doc} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5,
                  border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
                  <InsertDriveFileOutlinedIcon sx={{ color: "primary.main" }} />
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{doc}</Typography>
                  <Chip label="On File" color="success" size="small" variant="outlined" />
                </Box>
              ))
            )}
          </Box>
        )}

        {/* Tab 5: Timeline */}
        {tab === 5 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {MOCK_FLAT_TIMELINE.map((item, i) => (
              <Box key={i} sx={{ display: "flex", gap: 2, pb: 2 }}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", mt: 0.5, flexShrink: 0,
                    bgcolor: i < 2 ? "primary.main" : "divider" }} />
                  {i < MOCK_FLAT_TIMELINE.length - 1 && (
                    <Box sx={{ width: 2, flex: 1, bgcolor: "divider", mt: 0.5 }} />
                  )}
                </Box>
                <Box sx={{ pb: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{item.event}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatDate(item.date)}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{item.note}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

