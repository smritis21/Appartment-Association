import { useEffect, useMemo, useState } from "react";
import { Chip, Grid } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useResidents } from "../../../context/ResidentContext";
import { mockFlats, buildDirectoryRow, buildDynamicRows, FLAT_STATUS } from "../mock/directory";
import { mockHouseholds } from "../mock/households";
import { RESIDENT_STATUS } from "../../residents/mock/residents";
import { fetchDirectoryFlats } from "../../../services/directoryService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import DirectoryFilters from "../components/DirectoryFilters";
import DirectoryList from "../components/DirectoryList";
import { ROLES } from "../../../constants/roles";

export default function DirectoryPage() {
  const { residents } = useResidents();
  const [search, setSearch]         = useState("");
  const [roleFilter, setRole]       = useState("all");
  const [statusFilter, setStatus]   = useState("all");
  const [wingFilter, setWing]       = useState("all");

  const [apiRows, setApiRows] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetchDirectoryFlats({ limit: 100 })
      .then((rows) => { setApiRows(rows); setOffline(false); })
      .catch((err) => { if (isOffline(err)) setOffline(true); });
  }, []);

  const mockRows = useMemo(() => {
    const staticRows  = mockFlats.map((f) => buildDirectoryRow(f, residents));
    const dynamicRows = buildDynamicRows(mockFlats, residents);
    return [...staticRows, ...dynamicRows];
  }, [residents]);

  // Live flat data when available; fall back to the demo dataset only when
  // the backend is unreachable.
  const allRows = apiRows ?? mockRows;

  const stats = useMemo(() => {
    if (apiRows) {
      const total      = apiRows.length;
      const occupied    = apiRows.filter((r) => r.flat.status === "occupied").length;
      const vacant      = apiRows.filter((r) => r.flat.status === "vacant").length;
      const owners      = apiRows.filter((r) => r.owner).length;
      const tenants     = apiRows.filter((r) => r.tenant).length;
      const households  = apiRows.filter((r) => r.residentCount > 0).length;
      return { total, occupied, vacant, owners, tenants, households };
    }
    // Use allRows so newly approved residents (dynamic rows) are counted
    const total      = mockRows.length;
    const occupied   = mockRows.filter(({ flat }) => flat.status === FLAT_STATUS.OCCUPIED || flat.dynamic).length;
    const vacant     = mockRows.filter(({ flat }) => flat.status === FLAT_STATUS.VACANT).length;
    const owners     = residents.filter((r) => r.role === ROLES.OWNER && r.status === RESIDENT_STATUS.ACTIVE).length;
    const tenants    = residents.filter((r) => r.role === ROLES.TENANT && r.status === RESIDENT_STATUS.ACTIVE).length;
    const households = mockHouseholds.length;
    return { total, occupied, vacant, owners, tenants, households };
  }, [apiRows, mockRows, residents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(({ flat, owner, tenant }) => {
      if (statusFilter !== "all" && flat.status !== statusFilter) return false;
      if (wingFilter   !== "all" && flat.wing   !== wingFilter)   return false;
      if (roleFilter === "owner"  && !owner)  return false;
      if (roleFilter === "tenant" && !tenant) return false;
      if (!q) return true;
      return (
        flat.flat.toLowerCase().includes(q) ||
        flat.wing.toLowerCase().includes(q) ||
        owner?.name?.toLowerCase().includes(q)  ||
        owner?.email?.toLowerCase().includes(q) ||
        owner?.phone?.includes(q)               ||
        tenant?.name?.toLowerCase().includes(q)  ||
        tenant?.email?.toLowerCase().includes(q) ||
        tenant?.phone?.includes(q)
      );
    });
  }, [allRows, search, roleFilter, statusFilter, wingFilter]);

  const CARDS = [
    { title: "Total Flats",   value: stats.total,      icon: HomeOutlinedIcon,         color: "primary.main" },
    { title: "Occupied",      value: stats.occupied,   icon: CheckCircleOutlinedIcon,  color: "success.main" },
    { title: "Vacant",        value: stats.vacant,     icon: MeetingRoomOutlinedIcon,  color: "warning.main" },
    { title: "Owners",        value: stats.owners,     icon: PersonOutlinedIcon,       color: "secondary.main" },
    { title: "Tenants",       value: stats.tenants,    icon: PeopleOutlinedIcon,       color: "info.main" },
    { title: "Households",    value: stats.households, icon: GroupsOutlinedIcon,       color: "primary.main" },
  ];

  return (
    <>
      <PageHeader
        title="Directory"
        subtitle="Flat, household and resident directory"
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Directory" }]}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CARDS.map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={c.title}>
            <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />
          </Grid>
        ))}
      </Grid>

      <DirectoryFilters
        search={search}       onSearch={setSearch}
        roleFilter={roleFilter}   onRole={setRole}
        statusFilter={statusFilter} onStatus={setStatus}
        wingFilter={wingFilter}   onWing={setWing}
      />

      <DirectoryList rows={filtered} />
    </>
  );
}

