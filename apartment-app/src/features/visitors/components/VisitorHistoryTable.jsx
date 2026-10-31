import {
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ENTRY_CHIP } from "../mock/passes";
import { formatDateTime } from "../../../utils/formatDate";

const HEADERS = ["Code", "Visitor", "Flat", "Host", "Valid Window", "Status", "In / Out"];

export default function VisitorHistoryTable({ rows }) {
  return (
    <Paper elevation={1} sx={{ borderRadius: 2 }}>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {HEADERS.map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={HEADERS.length} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No visitor records match your filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const chip = ENTRY_CHIP[p.entry];
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="caption" fontFamily="var(--font-mono)" fontWeight={600} noWrap>
                        {p.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap>{p.visitorName}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.purpose}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>{p.flat}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>{p.host || "-"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {formatDateTime(p.validFrom)} - {formatDateTime(p.validTo)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={chip.label} color={chip.color} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        In: {p.entryAt ? formatDateTime(p.entryAt) : "-"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        Out: {p.exitAt ? formatDateTime(p.exitAt) : "-"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

