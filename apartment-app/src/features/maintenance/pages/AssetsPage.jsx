import { useMemo, useState } from "react";
import {
  Box,
  Card,
  Chip,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import BuildCircleOutlinedIcon from "@mui/icons-material/BuildCircleOutlined";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import { ASSETS, ASSET_STATUS_META, categoryLabel } from "../mock/assets";
import {
  workOrders,
  WO_STATUS,
  WO_TYPE_META,
  getHistoryForAsset,
  staffName,
} from "../mock/workOrders";
import { formatDate } from "../../../utils/formatDate";

// Asset register with a maintenance log per item. Selecting an asset on the left
// shows its details, any live (non-completed) work orders, and a dated history of
// completed maintenance with the recorded outcomes.
export default function AssetsPage() {
  const [selectedId, setSelectedId] = useState(ASSETS[0].id);
  const asset = ASSETS.find((a) => a.id === selectedId);

  const history = useMemo(() => getHistoryForAsset(selectedId), [selectedId]);
  const openOrders = useMemo(
    () => workOrders.filter((w) => w.assetId === selectedId && w.status !== WO_STATUS.COMPLETED),
    [selectedId],
  );

  const AssetIcon = asset?.icon ?? BuildCircleOutlinedIcon;
  const statusMeta = asset ? ASSET_STATUS_META[asset.status] : null;

  return (
    <Box>
      <PageHeader
        title="Assets"
        subtitle="Facilities and equipment with their maintenance history"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Assets" }]}
      />

      <Grid container spacing={2.5}>
        {/* Asset list */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
            <List dense sx={{ py: 0.5 }}>
              {ASSETS.map((a) => {
                const Icon = a.icon ?? BuildCircleOutlinedIcon;
                const meta = ASSET_STATUS_META[a.status];
                return (
                  <ListItemButton
                    key={a.id}
                    selected={a.id === selectedId}
                    onClick={() => setSelectedId(a.id)}
                    sx={{
                      borderRadius: 2,
                      mx: 0.75,
                      my: 0.25,
                      "&.Mui-selected": { bgcolor: "primary.light", color: "primary.dark" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={a.name}
                      secondary={categoryLabel(a.category)}
                      slotProps={{ primary: { fontSize: 13.5, fontWeight: a.id === selectedId ? 700 : 500 } }}
                    />
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: `${meta.color}.main`, ml: 1 }} />
                  </ListItemButton>
                );
              })}
            </List>
          </Card>
        </Grid>

        {/* Selected asset detail + history */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", p: 2.5, mb: 2.5 }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AssetIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                  <Typography variant="h6" fontWeight={700}>{asset.name}</Typography>
                  {statusMeta && (
                    <Chip size="small" label={statusMeta.label} color={statusMeta.color} variant="filled" />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {categoryLabel(asset.category)} · {asset.location}
                </Typography>
                <Stack direction="row" spacing={3} sx={{ mt: 1 }} flexWrap="wrap">
                  <Detail label="Serial no." value={asset.serialNo} mono />
                  <Detail label="Installed" value={formatDate(asset.installedOn)} />
                  <Detail label="Open orders" value={openOrders.length} />
                  <Detail label="Completed jobs" value={history.length} />
                </Stack>
              </Box>
            </Stack>

            {openOrders.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
                  Active work orders
                </Typography>
                <Stack spacing={0.75}>
                  {openOrders.map((w) => (
                    <Box key={w.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="caption" sx={{ fontFamily: "var(--font-mono)", color: "text.disabled" }}>
                        {w.id}
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 160 }}>{w.title}</Typography>
                      <Chip size="small" label={WO_TYPE_META[w.type].label} color={WO_TYPE_META[w.type].color} variant="outlined" />
                      <Typography variant="caption" color="text.secondary">
                        Due {formatDate(w.dueDate, { weekday: "short" })}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ px: 2.5, pt: 2 }}>
              Maintenance history
            </Typography>
            {history.length === 0 ? (
              <EmptyState
                icon={BuildCircleOutlinedIcon}
                title="No history yet"
                description="Completed work orders for this asset will appear here with their dates and outcomes."
              />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Work</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>By</TableCell>
                      <TableCell>Outcome</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id} hover>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(h.date)}</TableCell>
                        <TableCell sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{h.id}</TableCell>
                        <TableCell>{h.title}</TableCell>
                        <TableCell>
                          <Chip size="small" label={WO_TYPE_META[h.type].label} color={WO_TYPE_META[h.type].color} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{staffName(h.assignee) ?? "-"}</TableCell>
                        <TableCell sx={{ color: "text.secondary", minWidth: 220 }}>{h.outcome}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function Detail({ label, value, mono }) {
  return (
    <Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={mono ? { fontFamily: "var(--font-mono)", fontSize: 13 } : undefined}>
        {value}
      </Typography>
    </Box>
  );
}

