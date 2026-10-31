import { Box, Breadcrumbs, Typography } from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Link as RouterLink } from "react-router-dom";

export default function PageHeader({ title, subtitle, breadcrumbs = [], action }) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 1 }}
        >
          {breadcrumbs.map((crumb, i) =>
            crumb.href ? (
              <RouterLink
                key={i}
                to={crumb.href}
                style={{ color: "inherit", textDecoration: "none", fontSize: 13 }}
                onMouseEnter={(e) => (e.target.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.target.style.textDecoration = "none")}
              >
                {crumb.label}
              </RouterLink>
            ) : (
              <Typography key={i} variant="body2" color="text.primary">
                {crumb.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      )}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box className="no-print">{action}</Box>}
      </Box>
    </Box>
  );
}
