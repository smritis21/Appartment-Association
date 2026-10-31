import {
  Box, Chip, Divider, Grid, Paper, Tab, Tabs, Typography,
} from "@mui/material";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import { useState } from "react";
import { ROLE_LABELS, ROLE_COLORS } from "../../auth/mock/roles";
import ResidentStatusChip from "./ResidentStatusChip";
import { formatDate } from "../../../utils/formatDate";
import { mockFamilyMembers } from "../mock/family";
import EmptyState from "../../../components/common/EmptyState";

const DOC_LABEL = {
  aadhaar:          "Aadhaar Card",
  pan:              "PAN Card",
  sale_deed:        "Sale Deed",
  rental_agreement: "Rental Agreement",
  photo:            "Passport Photo",
};

/**
 * Builds a per-resident timeline from the fields already on the resident
 * record (move-in date, move-out date, current status).
 */
function buildResidentTimeline(resident) {
  const flatLabel = `Wing ${resident.wing || "-"}, Flat ${resident.flat || "-"}`;
  const events = [];

  if (resident.moveInDate) {
    events.push({
      event: "Moved In",
      date: resident.moveInDate,
      note: `${resident.name || "Resident"} moved into ${flatLabel}.`,
    });
  } else {
    events.push({
      event: "Resident Record Created",
      date: null,
      note: `${resident.name || "Resident"} was added to ${flatLabel}.`,
    });
  }

  if (resident.moveOutDate || resident.status === "moved_out") {
    events.push({
      event: "Moved Out",
      date: resident.moveOutDate,
      note: `${resident.name || "Resident"} moved out of ${flatLabel}.`,
    });
  } else if (resident.status === "inactive") {
    events.push({
      event: "Deactivated",
      date: null,
      note: `${resident.name || "Resident"}'s account was deactivated.`,
    });
  } else {
    events.push({
      event: "Active Resident",
      date: null,
      note: `${resident.name || "Resident"} is currently an active resident at ${flatLabel}.`,
    });
  }

  return events;
}

function InfoRow({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value || "-"}</Typography>
    </Grid>
  );
}

export default function ResidentDetailTabs({ resident }) {
  const [tab, setTab] = useState(0);
  const family = mockFamilyMembers[resident.id] ?? [];
  const timeline = buildResidentTimeline(resident);

  return (
    <Paper elevation={1} sx={{ borderRadius: 3 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: "1px solid", borderColor: "divider", px: 2 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {["Information", "Family", "Documents", "Occupancy", "Timeline"].map((label) => (
          <Tab key={label} label={label} sx={{ fontSize: 13, fontWeight: 600, textTransform: "none" }} />
        ))}
      </Tabs>

      <Box sx={{ p: 3 }}>
        {/* Tab 0: Information */}
        {tab === 0 && (
          <Grid container spacing={2}>
            <InfoRow label="Full Name"   value={resident.name} />
            <InfoRow label="Email"       value={resident.email} />
            <InfoRow label="Phone"       value={resident.phone} />
            <InfoRow label="Occupation"  value={resident.occupation} />
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" display="block">Role</Typography>
              <Chip label={ROLE_LABELS[resident.role] ?? resident.role}
                color={ROLE_COLORS[resident.role] ?? "default"} size="small" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <ResidentStatusChip status={resident.status} />
            </Grid>
            <Grid size={12}><Divider /></Grid>
            <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, pt: 1, width: "100%" }}>
              Emergency Contact
            </Typography>
            <InfoRow label="Name"     value={resident.emergencyContact?.name} />
            <InfoRow label="Relation" value={resident.emergencyContact?.relation} />
            <InfoRow label="Phone"    value={resident.emergencyContact?.phone} />
          </Grid>
        )}

        {/* Tab 1: Family */}
        {tab === 1 && (
          family.length === 0 ? (
            <EmptyState
              icon={PeopleOutlinedIcon}
              title="No Family Members"
              description="No family members have been recorded for this resident."
            />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {family.map((m) => (
                <Paper key={m.id} variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.relation} · Age {m.age}
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

        {/* Tab 2: Documents */}
        {tab === 2 && (
          resident.documents?.length === 0 ? (
            <EmptyState
              icon={FolderOpenOutlinedIcon}
              title="No Documents"
              description="No documents have been uploaded for this resident."
            />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {(resident.documents ?? []).map((doc) => (
                <Box key={doc} sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: 1.5, border: "1px solid", borderColor: "divider",
                  borderRadius: 2, bgcolor: "background.default",
                }}>
                  <InsertDriveFileOutlinedIcon sx={{ color: "primary.main" }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{DOC_LABEL[doc] ?? doc}</Typography>
                    <Typography variant="caption" color="text.secondary">Verified</Typography>
                  </Box>
                  <Chip label="On File" color="success" size="small" variant="outlined" />
                </Box>
              ))}
            </Box>
          )
        )}

        {/* Tab 3: Occupancy */}
        {tab === 3 && (
          <Grid container spacing={2}>
            <InfoRow label="Wing"        value={resident.wing} />
            <InfoRow label="Flat"        value={resident.flat} />
            <InfoRow label="Move-in Date" value={formatDate(resident.moveInDate)} />
            <InfoRow label="Move-out Date" value={resident.moveOutDate ? formatDate(resident.moveOutDate) : "Current Resident"} />
            {resident.ownerName && <InfoRow label="Owner Name" value={resident.ownerName} />}
            {resident.leaseStart && <InfoRow label="Lease Start" value={formatDate(resident.leaseStart)} />}
            {resident.leaseEnd   && <InfoRow label="Lease End"   value={formatDate(resident.leaseEnd)} />}
          </Grid>
        )}

        {/* Tab 4: Timeline */}
        {tab === 4 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {timeline.map((item, i) => (
              <Box key={i} sx={{ display: "flex", gap: 2, pb: 2 }}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Box sx={{
                    width: 10, height: 10, borderRadius: "50%", mt: 0.5, flexShrink: 0,
                    bgcolor: "primary.main",
                  }} />
                  {i < timeline.length - 1 && (
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

