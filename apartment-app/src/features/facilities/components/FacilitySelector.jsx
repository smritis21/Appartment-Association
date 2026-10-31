import { Box, Card, CardActionArea, Chip, Grid, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { FACILITIES } from "../mock/facilities";

// Facility picker. Renders a selectable card per facility (gym / pool / court).
// Controlled by the parent so it can validate before a booking is allowed.
export default function FacilitySelector({ selectedId, onSelect }) {
  return (
    <Grid container spacing={2}>
      {FACILITIES.map((facility) => {
        const Icon = facility.icon;
        const selected = selectedId === facility.id;
        return (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={facility.id}>
            <Card
              variant="outlined"
              sx={{
                position: "relative",
                height: "100%",
                borderRadius: 3,
                borderWidth: 1.5,
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: selected ? "primary.light" : "background.paper",
                transition: "border-color .15s, background-color .15s, transform .15s",
                "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)" },
              }}
            >
              {selected && (
                <CheckCircleIcon
                  color="primary"
                  sx={{ position: "absolute", top: 10, right: 10, fontSize: 20, zIndex: 1 }}
                />
              )}
              <CardActionArea onClick={() => onSelect(facility)} sx={{ p: 2, height: "100%", display: "block" }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 1.25,
                    bgcolor: selected ? "background.paper" : "primary.light",
                    color: "primary.main",
                  }}
                >
                  <Icon />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  {facility.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  {facility.location}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {facility.description}
                </Typography>
                <Chip
                  size="small"
                  label={facility.capacity === 1 ? "1 party per slot" : `${facility.capacity} slots per hour`}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                />
              </CardActionArea>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
