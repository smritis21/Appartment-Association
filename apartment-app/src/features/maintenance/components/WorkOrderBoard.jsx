import { Box, Button, Card, Chip, Stack, Tooltip, Typography } from "@mui/material";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  WO_STATUS,
  WO_STATUS_META,
  WO_FLOW,
  PRIORITY_META,
  WO_TYPE_META,
  isOverdue,
  staffName,
} from "../mock/workOrders";
import { assetName } from "../mock/assets";
import { formatDate } from "../../../utils/formatDate";

const COLUMNS = WO_FLOW; // open → assigned → in_progress → completed

// Single work-order card. Shows priority + type, the linked asset, who it's on,
// the due date, and an overdue flag when it has slipped. Actions differ by
// status: open/assigned/in-progress can be advanced; anything not completed can
// be assigned or edited.
function WorkOrderCard({ wo, onAssign, onAdvance, onEdit }) {
  const overdue = isOverdue(wo);
  const priority = PRIORITY_META[wo.priority];
  const canAdvance = wo.status !== WO_STATUS.COMPLETED;
  const nextLabel =
    WO_STATUS_META[WO_FLOW[WO_FLOW.indexOf(wo.status) + 1]]?.label ?? "";

  return (
    <Card
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        borderColor: overdue ? "error.main" : "divider",
        borderLeft: "4px solid",
        borderLeftColor: overdue ? "error.main" : `${priority.color}.main`,
        transition: "box-shadow .15s, transform .1s",
        "&:hover": { boxShadow: 3, transform: "translateY(-1px)" },
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ mb: 0.75, flexWrap: "wrap", gap: 0.5 }}>
        <Chip size="small" label={priority.label} color={priority.color} variant="filled" />
        <Chip
          size="small"
          label={WO_TYPE_META[wo.type].label}
          color={WO_TYPE_META[wo.type].color}
          variant="outlined"
        />
        {overdue && (
          <Chip
            size="small"
            icon={<WarningAmberOutlinedIcon />}
            label="Overdue"
            color="error"
            variant="filled"
          />
        )}
      </Stack>

      <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.35 }}>
        {wo.title}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "text.disabled", fontFamily: "var(--font-mono)", display: "block", mb: 0.75 }}
      >
        {wo.id} · {assetName(wo.assetId)}
      </Typography>

      <Stack spacing={0.4} sx={{ mb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <PersonOutlineOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">
            {staffName(wo.assignee) ?? "Unassigned"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <EventOutlinedIcon sx={{ fontSize: 15, color: overdue ? "error.main" : "text.secondary" }} />
          <Typography variant="caption" color={overdue ? "error.main" : "text.secondary"} fontWeight={overdue ? 700 : 400}>
            Due {formatDate(wo.dueDate, { weekday: "short" })}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
        {canAdvance && (
          <Button
            size="small"
            variant="contained"
            endIcon={<ArrowForwardOutlinedIcon />}
            onClick={() => onAdvance(wo)}
            sx={{ py: 0.25, fontSize: 12 }}
          >
            {nextLabel}
          </Button>
        )}
        {canAdvance && (
          <Tooltip title="Assign / reassign">
            <Button size="small" variant="outlined" color="inherit" onClick={() => onAssign(wo)} sx={{ py: 0.25, fontSize: 12 }}>
              Assign
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Edit">
          <Button size="small" variant="text" color="inherit" onClick={() => onEdit(wo)} sx={{ minWidth: 34, py: 0.25 }}>
            <EditOutlinedIcon sx={{ fontSize: 17 }} />
          </Button>
        </Tooltip>
      </Stack>
    </Card>
  );
}

// The board: one column per lifecycle status, each headed with a live count.
// Horizontally scrollable on small screens so all four columns stay usable.
export default function WorkOrderBoard({ workOrders, onAssign, onAdvance, onEdit }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(4, minmax(230px, 1fr))", lg: "repeat(4, 1fr)" },
        gap: 2,
        overflowX: "auto",
        pb: 1,
      }}
    >
      {COLUMNS.map((status) => {
        const meta = WO_STATUS_META[status];
        const items = workOrders.filter((w) => w.status === status);
        return (
          <Box key={status} sx={{ minWidth: 230 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.25,
                py: 1,
                mb: 1.25,
                borderRadius: 2,
                bgcolor: "background.default",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                {meta.label}
              </Typography>
              <Chip size="small" label={items.length} color={meta.color === "default" ? undefined : meta.color} />
            </Box>

            <Stack spacing={1.25}>
              {items.length === 0 ? (
                <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
                  Nothing here.
                </Typography>
              ) : (
                items.map((wo) => (
                  <WorkOrderCard
                    key={wo.id}
                    wo={wo}
                    onAssign={onAssign}
                    onAdvance={onAdvance}
                    onEdit={onEdit}
                  />
                ))
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
