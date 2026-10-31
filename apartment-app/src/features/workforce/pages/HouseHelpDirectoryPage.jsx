import { useMemo, useState } from "react";
import { Box, Grid } from "@mui/material";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import CategoryFilter from "../components/CategoryFilter";
import HouseHelpCard from "../components/HouseHelpCard";
import { getHelpByCategory } from "../mock/houseHelp";

// Resident house-help directory: browse workers by category (maid, cook, driver, etc.)
export default function HouseHelpDirectoryPage() {
  const [category, setCategory] = useState("all");

  const workers = useMemo(() => getHelpByCategory(category), [category]);

  return (
    <Box>
      <PageHeader
        title="House-Help Directory"
        subtitle="Browse verified maids, cooks, drivers and domestic helpers in the community"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "House Help" }]}
      />

      <Box sx={{ mb: 2.5 }}>
        <CategoryFilter value={category} onChange={setCategory} />
      </Box>

      {workers.length === 0 ? (
        <EmptyState
          icon={PeopleOutlineOutlinedIcon}
          title="No house help in this category"
          description="Try another category filter."
        />
      ) : (
        <Grid container spacing={2}>
          {workers.map((help) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={help.id}>
              <HouseHelpCard help={help} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

