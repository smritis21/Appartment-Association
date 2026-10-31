// Central design system for the community portal.
// Green/gold "estate" identity, refined for depth, motion and polish.

const SERIF = "'Source Serif 4', 'Source Serif Pro', Georgia, serif";
const SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Layered, soft shadow ramp (replaces MUI's default hard shadows).
const softShadow = "0 4px 12px -2px rgba(27,36,48,0.10), 0 2px 6px -2px rgba(27,36,48,0.06)";
const shadows = [
  "none",
  "0 1px 2px rgba(27,36,48,0.06), 0 1px 3px rgba(27,36,48,0.05)",
  softShadow,
  "0 8px 20px -4px rgba(27,36,48,0.12), 0 3px 8px -3px rgba(27,36,48,0.07)",
  "0 12px 28px -6px rgba(27,36,48,0.16), 0 6px 12px -4px rgba(27,36,48,0.08)",
  ...Array(20).fill("0 18px 40px -8px rgba(27,36,48,0.20), 0 8px 16px -6px rgba(27,36,48,0.10)"),
];

// Named constant so App.jsx can swap it for darkPalette at runtime based on
// the user's theme preference.
export const lightPalette = {
  mode: "light",
  primary: {
    main: "#2f5233",
    light: "#e7ede6",
    dark: "#1e3521",
    contrastText: "#ffffff",
  },
  secondary: {
    main: "#a8823c",
    light: "#f5ead8",
    dark: "#7a5e28",
    contrastText: "#ffffff",
  },
  error: { main: "#a83b3b", light: "#f7e5e5" },
  warning: { main: "#b5721f", light: "#f9edda" },
  success: { main: "#2f7a3f", light: "#e3f1e6" },
  info: { main: "#2f5aa8", light: "#e4eaf5" },
  background: {
    default: "#f3f1ec",
    paper: "#ffffff",
  },
  text: {
    primary: "#1b2430",
    secondary: "#5b6472",
    disabled: "#98a0ac",
  },
  divider: "#e4e0d6",
};

// Dark palette - same structure/keys as lightPalette, values chosen to keep
// the same green/gold "estate" identity legible on a dark background.
export const darkPalette = {
  mode: "dark",
  primary: {
    main: "#6fae76",
    light: "#3a5c40",
    dark: "#4d8455",
    contrastText: "#0d1710",
  },
  secondary: {
    main: "#d4ac6a",
    light: "#4a3e26",
    dark: "#a8823c",
    contrastText: "#1c1608",
  },
  error: { main: "#e08585", light: "#4a2626" },
  warning: { main: "#e0a95f", light: "#4a3820" },
  success: { main: "#7fc98c", light: "#22402a" },
  info: { main: "#89a7e0", light: "#20304a" },
  background: {
    default: "#12161a",
    paper: "#1b2027",
  },
  text: {
    primary: "#eceef0",
    secondary: "#a7afb9",
    disabled: "#6a7280",
  },
  divider: "#2c333c",
};

const themeConfig = {
  palette: lightPalette,

  typography: {
    fontFamily: SANS,
    h1: { fontFamily: SERIF, fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: SERIF, fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontFamily: SERIF, fontWeight: 700, letterSpacing: "-0.015em" },
    h4: { fontFamily: SERIF, fontWeight: 600, letterSpacing: "-0.01em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700, letterSpacing: "-0.005em" },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, letterSpacing: "0.01em" },
    overline: { letterSpacing: "0.08em", fontWeight: 600 },
  },

  shape: { borderRadius: 10 },
  shadows,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { transition: "background-color 0.3s ease" },
        "input::-ms-reveal, input::-ms-clear, input::-webkit-contacts-auto-fill-button, input::-webkit-credentials-auto-fill-button": {
          display: "none !important",
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 10,
          paddingInline: 18,
          fontWeight: 600,
          transition:
            "transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, background-color 0.18s ease",
          "&:hover": { transform: "translateY(-1px)" },
          "&:active": { transform: "translateY(0)" },
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #35603a 0%, #2f5233 60%, #274529 100%)",
          boxShadow: "0 2px 8px -1px rgba(47,82,51,0.35)",
          "&:hover": {
            boxShadow: "0 8px 20px -4px rgba(47,82,51,0.45)",
          },
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #bd9550 0%, #a8823c 100%)",
          boxShadow: "0 2px 8px -1px rgba(168,130,60,0.35)",
        },
        outlined: {
          borderWidth: 1.5,
          "&:hover": { borderWidth: 1.5, backgroundColor: "rgba(47,82,51,0.05)" },
        },
        sizeLarge: { paddingBlock: 10, fontSize: "0.95rem" },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: "background-color 0.18s ease, transform 0.18s ease, color 0.18s ease",
          "&:hover": { transform: "translateY(-1px)" },
        },
        colorSuccess: { "&:hover": { backgroundColor: "rgba(47,122,63,0.12)" } },
        colorError: { "&:hover": { backgroundColor: "rgba(168,59,59,0.12)" } },
        colorPrimary: { "&:hover": { backgroundColor: "rgba(47,82,51,0.12)" } },
      },
    },

    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 14 },
        outlined: { borderColor: "#e4e0d6" },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: "1px solid #e9e5db",
          backgroundImage: "none",
          boxShadow: softShadow,
          transition:
            "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease, border-color 0.22s ease",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        // Version-proof: style via ownerState instead of generated color slots,
        // so soft-tinted status badges apply on any MUI version.
        root: ({ ownerState }) => {
          const tints = {
            primary:   { bg: "#e7ede6", fg: "#2b5030", bd: "#cddccd" },
            secondary: { bg: "#f5ead8", fg: "#7a5a1f", bd: "#ecdcbe" },
            success:   { bg: "#e4f1e7", fg: "#256b34", bd: "#c6e3cd" },
            warning:   { bg: "#faedd8", fg: "#8a5716", bd: "#eeddbb" },
            error:     { bg: "#f7e5e5", fg: "#8f2f2f", bd: "#ecccca" },
            info:      { bg: "#e5ebf6", fg: "#274b8a", bd: "#cdd8ee" },
            default:   { bg: "#eeece6", fg: "#4a5260", bd: "#e0dccf" },
          };
          const t = tints[ownerState.color] || tints.default;
          const isFilled = ownerState.variant === "filled";
          const isOutlined = ownerState.variant === "outlined";
          return {
            fontWeight: 600,
            borderRadius: 8,
            letterSpacing: "0.01em",
            ...(isFilled && {
              backgroundColor: t.bg,
              color: t.fg,
              border: `1px solid ${t.bd}`,
              "& .MuiChip-icon, & .MuiChip-deleteIcon": { color: t.fg },
            }),
            ...(isOutlined && ownerState.color === "default" && {
              backgroundColor: "#fbfaf7",
              borderColor: "#d7d2c5",
              color: "#4a5260",
            }),
          };
        },
        sizeSmall: { height: 23, fontSize: "0.72rem" },
        label: { paddingInline: 10 },
      },
    },

    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: "inherit" },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "#eee9de",
          paddingTop: 12,
          paddingBottom: 12,
          "&:first-of-type": { paddingLeft: 20 },
          "&:last-of-type": { paddingRight: 20 },
        },
        sizeSmall: { paddingTop: 10, paddingBottom: 10 },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backdropFilter: "saturate(180%) blur(12px)",
          WebkitBackdropFilter: "saturate(180%) blur(12px)",
        },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "background-color 0.18s ease, color 0.18s ease, padding-left 0.18s ease",
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "box-shadow 0.18s ease",
          "&.Mui-focused": {
            boxShadow: "0 0 0 3px rgba(47,82,51,0.12)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#c7c2b4",
          },
        },
      },
    },

    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-root": {
            fontWeight: 700,
            color: "#5b6472",
            backgroundColor: "#faf9f5",
            borderBottom: "1px solid #e4e0d6",
            fontSize: "0.78rem",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
          },
        },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 0.15s ease",
          "&:hover": { backgroundColor: "rgba(47,82,51,0.035)" },
          "&:last-child td": { borderBottom: 0 },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#1b2430",
          fontSize: "0.72rem",
          fontWeight: 500,
          borderRadius: 8,
          padding: "6px 10px",
        },
        arrow: { color: "#1b2430" },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 8 },
        bar: { borderRadius: 999 },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 18 },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
  },
};

export default themeConfig;
