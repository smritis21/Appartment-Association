import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import { useState } from "react";
import {
  ENTRY_STATE,
  ENTRY_CHIP,
  PASS_STATE,
  computePassState,
} from "../mock/passes";
import { formatDateTime } from "../../../utils/formatDate";

export default function GateVerifyPanel({ onLookup, onEntry, onDeny, onExit }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null); // { pass } | { notFound: true }
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const pass = await onLookup(code.trim());
      setResult(pass ? { pass } : { notFound: true });
    } finally {
      setLoading(false);
    }
  };

  const act = (fn, pass) => {
    fn(pass);
    setResult(null);
    setCode("");
  };

  const pass = result?.pass;
  const state = pass ? computePassState(pass) : null;
  const chip = pass ? ENTRY_CHIP[pass.entry] : null;

  return (
    <Paper elevation={1} sx={{ borderRadius: 2, p: 3, maxWidth: 560 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Verify a visitor pass
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Type the pass code shown by the visitor - it's printed below their QR
        code as a backup, since this desk doesn't scan QR codes yet.
      </Typography>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="e.g. JKR-4821"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          inputProps={{ style: { fontFamily: "var(--font-mono)", letterSpacing: 2 } }}
        />
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <QrCodeScannerOutlinedIcon />}
          disabled={loading}
          onClick={verify}
        >
          Verify
        </Button>
      </Box>

      {result?.notFound && (
        <Alert severity="error" sx={{ mt: 2 }}>
          No pass found for “{code.trim()}”. Ask the visitor to confirm the code.
        </Alert>
      )}

      {pass && (
        <Box sx={{ mt: 2.5 }}>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              {pass.visitorName}
            </Typography>
            <Chip label={chip.label} color={chip.color} size="small" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {pass.purpose} · Flat {pass.flat} · Host {pass.host}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Valid {formatDateTime(pass.validFrom)} - {formatDateTime(pass.validTo)}
          </Typography>

          {state === PASS_STATE.UPCOMING && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This pass is not valid yet. Entry opens at {formatDateTime(pass.validFrom)}.
            </Alert>
          )}
          {state === PASS_STATE.EXPIRED && pass.entry !== ENTRY_STATE.ON_PREMISE && (
            <Alert severity="error" sx={{ mt: 2 }}>
              This pass expired on {formatDateTime(pass.validTo)}.
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
            {pass.entry === ENTRY_STATE.AWAITING && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<LoginOutlinedIcon />}
                  disabled={state !== PASS_STATE.ACTIVE}
                  onClick={() => act(onEntry, pass)}
                >
                  Approve Entry
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<BlockOutlinedIcon />}
                  onClick={() => act(onDeny, pass)}
                >
                  Deny
                </Button>
              </>
            )}
            {pass.entry === ENTRY_STATE.ON_PREMISE && (
              <Button
                variant="contained"
                color="info"
                startIcon={<LogoutOutlinedIcon />}
                onClick={() => act(onExit, pass)}
              >
                Record Exit
              </Button>
            )}
            {(pass.entry === ENTRY_STATE.EXITED || pass.entry === ENTRY_STATE.DENIED) && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No further action - visitor already {chip.label.toLowerCase()}.
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

