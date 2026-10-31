import { Box } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";

// A real, scannable QR code encoding the pass code - the human-readable
// code below it on PassCard is what a guard reads by eye, and this is what
// a phone camera can check the same value against.
//
// marginSize is set explicitly because qrcode.react defaults it to 0 - the
// QR spec requires a 4-module quiet zone around the code for a scanner to
// even detect it, so without this the code renders but doesn't scan.
export default function QrCode({ value, size = 96 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        bgcolor: "#fff",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <QRCodeSVG
        value={value}
        size={size - 4}
        bgColor="#ffffff"
        fgColor="#000000"
        level="M"
        marginSize={4}
      />
    </Box>
  );
}
