import { Box, Button, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { PASS_TYPE } from "../mock/passes";
import { VISITOR_PURPOSES } from "../mock/visitors";
import { validators } from "../../../utils/validators";

// Built from local date parts, not toISOString() (which is UTC) - in a
// timezone ahead of UTC (e.g. IST), toISOString() still reports "yesterday"
// for several hours after local midnight, defaulting the date field wrong.
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Local HH:MM for `now` plus an hour offset, so a freshly issued pass opens
// as Active rather than defaulting to a window that may already be in the past.
function timeStr(hoursFromNow = 0) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function GuestPassForm({ onIssue, onCancel }) {
  const [type, setType] = useState(PASS_TYPE.GUEST);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      visitorName: "",
      purpose: type === PASS_TYPE.DELIVERY ? "Delivery" : "Guest Visit",
      phone: "",
      date: todayStr(),
      fromTime: timeStr(0),
      toTime: timeStr(3),
    },
  });

  const submit = (data) => {
    const validFrom = new Date(`${data.date}T${data.fromTime}`).toISOString();
    const validTo = new Date(`${data.date}T${data.toTime}`).toISOString();
    onIssue({
      type,
      visitorName: data.visitorName.trim(),
      purpose: data.purpose,
      phone: data.phone,
      validFrom,
      validTo,
    });
  };

  const purposes = type === PASS_TYPE.DELIVERY ? ["Delivery"] : VISITOR_PURPOSES;

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate sx={{ pt: 1 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={type}
        onChange={(_, v) => v && setType(v)}
        sx={{ mb: 2.5 }}
      >
        <ToggleButton value={PASS_TYPE.GUEST}>Guest Pass</ToggleButton>
        <ToggleButton value={PASS_TYPE.DELIVERY}>Expected Delivery</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        label={type === PASS_TYPE.DELIVERY ? "Delivery / Courier" : "Visitor Name"}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.visitorName}
        helperText={errors.visitorName?.message}
        {...register("visitorName", validators.required("Name"))}
      />

      <TextField
        select
        label="Purpose"
        fullWidth
        size="small"
        defaultValue={type === PASS_TYPE.DELIVERY ? "Delivery" : "Guest Visit"}
        sx={{ mb: 2 }}
        {...register("purpose")}
      >
        {purposes.map((p) => (
          <MenuItem key={p} value={p}>
            {p}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Visitor Phone"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.phone}
        helperText={errors.phone?.message}
        {...register("phone", validators.phone)}
      />

      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
        Valid time window
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
        <TextField
          type="date"
          label="Date"
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("date", validators.required("Date"))}
        />
        <TextField
          type="time"
          label="From"
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("fromTime", validators.required("Start time"))}
        />
        <TextField
          type="time"
          label="To"
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
          {...register("toTime", validators.required("End time"))}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onCancel} color="inherit" variant="outlined">
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          Issue Pass
        </Button>
      </Box>
    </Box>
  );
}
