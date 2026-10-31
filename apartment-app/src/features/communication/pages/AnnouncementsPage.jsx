// FE-04 + FE-09: Announcements Dashboard with search/filter
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider,
  Grid, InputAdornment, MenuItem, Paper, Select, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useEffect, useState } from "react";
import { getAnnouncements } from "../mock/communicationData";
import PageHeader from "../../../components/common/PageHeader";
import { fetchAnnouncements, searchAnnouncements } from "../../../services/announcementService";
import { isOffline } from "../../../services/apiClient";

const CATEGORIES = ["All", "Maintenance", "Event", "Safety", "Finance", "General", "Emergency"];

const CATEGORY_COLOR = {
  Maintenance: "default",
  Event:       "primary",
  Safety:      "warning",
  Finance:     "success",
  General:     "default",
  Emergency:   "error",
};

function AnnouncementCard({ ann, onClick, active }) {
  const chipColor = CATEGORY_COLOR[ann.category] ?? "default";

  return (
    <Card
      elevation={active ? 3 : 1}
      onClick={onClick}
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: active ? "primary.main" : "divider",
        bgcolor: active ? "primary.light" : "background.paper",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": { borderColor: "primary.main", boxShadow: 3 },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        {ann.pinned && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
            <PushPinOutlinedIcon sx={{ fontSize: 13, color: "secondary.main" }} />
            <Typography variant="caption" color="secondary.main" fontWeight={700}>Pinned</Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.35 }}>
            {ann.title}
          </Typography>
          <Chip label={ann.category} size="small" color={chipColor} sx={{ flexShrink: 0, height: 20, fontSize: 10 }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {ann.body}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <CalendarTodayOutlinedIcon sx={{ fontSize: 12, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">{ann.date}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PersonOutlinedIcon sx={{ fontSize: 12, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">{ann.author}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function AnnouncementDetail({ ann, onClose }) {
  const chipColor = CATEGORY_COLOR[ann.category] ?? "default";

  return (
    <Paper elevation={1} sx={{ borderRadius: 2, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <CampaignOutlinedIcon color="primary" />
          <Chip label={ann.category} size="small" color={chipColor} />
          {ann.pinned && <Chip label="Pinned" size="small" color="secondary" icon={<PushPinOutlinedIcon />} />}
        </Box>
        <Button size="small" variant="outlined" onClick={onClose} startIcon={<CloseIcon />} sx={{ minWidth: 0 }}>
          Close
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ lineHeight: 1.3 }}>
          {ann.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 3, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <CalendarTodayOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">{ann.date}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <PersonOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">{ann.author}</Typography>
          </Box>
        </Box>
        <Divider sx={{ mb: 2.5 }} />
        <Typography variant="body1" sx={{ lineHeight: 1.8, color: "text.primary" }}>
          {ann.body}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function AnnouncementsPage() {
  // INT-04: the list comes from the live API. If the backend is unreachable we
  // fall back to the mock so the screen still demonstrates, and say so.
  const [allAnnouncements, setAllAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  // INT-09: keyword and category are resolved by the server. The search box is
  // debounced so a typed word is one request, not one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const isSearching = Boolean(debouncedSearch) || category !== "All";
    try {
      // With no keyword or category the plain list endpoint is the right call:
      // it is the one that returns pinned notices first.
      const rows = isSearching
        ? await searchAnnouncements({ keyword: debouncedSearch, category })
        : await fetchAnnouncements();
      setAllAnnouncements(rows);
      setOffline(false);
      setLoadError("");
    } catch (err) {
      if (isOffline(err)) {
        setAllAnnouncements(getAnnouncements());
        setOffline(true);
        setLoadError("");
      } else {
        // A 4xx/5xx is a real problem worth surfacing rather than hiding
        // behind mock data that would look like success.
        setAllAnnouncements([]);
        setOffline(false);
        setLoadError(err?.message || "Could not load announcements.");
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  useEffect(() => { refresh(); }, [refresh]);

  // Keyword and category have already been applied by the API. The date
  // control offers "this week"/"this month" ranges, which the search endpoint
  // cannot express - it filters on a single exact day - so the range is
  // narrowed here over the timestamps the API returned.
  //
  // When the backend is unreachable the offline fallback is unfiltered mock
  // data, so keyword and category are re-applied locally to keep the screen
  // behaving the same way.
  const matchesLocalSearch = (a) => {
    if (!offline) return true;
    const term = debouncedSearch.toLowerCase();
    const matchTerm =
      !term ||
      a.title.toLowerCase().includes(term) ||
      a.body.toLowerCase().includes(term) ||
      a.category.toLowerCase().includes(term);
    return matchTerm && (category === "All" || a.category === category);
  };

  const matchesDateFilter = (a) => {
    if (dateFilter === "all") return true;
    if (!a.createdAt) return false;
    const created = new Date(a.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const days = dateFilter === "week" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return created >= cutoff;
  };

  const filtered = allAnnouncements.filter((a) => matchesLocalSearch(a) && matchesDateFilter(a));

  const pinned = filtered.filter((a) => a.pinned);
  const regular = filtered.filter((a) => !a.pinned);
  const selected = allAnnouncements.find((a) => a.id === selectedId);

  const hasFilters = search || category !== "All" || dateFilter !== "all";

  return (
    <Box>
      <PageHeader
        title="Announcements"
        subtitle="Society notices, updates, and important communications from the Association"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Announcements" }]}
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing sample announcements - the server is unreachable.
        </Alert>
      )}
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button size="small" color="inherit" onClick={refresh}>Retry</Button>
        }>
          {loadError}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        {/* ── Left: List ───────────────────────────── */}
        <Box sx={{ flex: selected ? "0 0 420px" : 1, minWidth: 0 }}>
          {/* FE-09: Search & Filter bar */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by keyword, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <CloseIcon fontSize="small" sx={{ cursor: "pointer", color: "text.secondary" }} onClick={() => setSearch("")} />
                    </InputAdornment>
                  ) : null,
                },
              }}
              sx={{ mb: 1.5 }}
            />
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
              <Select
                size="small"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                sx={{ minWidth: 130, fontSize: 12.5 }}
              >
                {CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>
                ))}
              </Select>
              <ToggleButtonGroup
                size="small"
                value={dateFilter}
                exclusive
                onChange={(_, v) => v && setDateFilter(v)}
                sx={{ "& .MuiToggleButton-root": { fontSize: 11.5, px: 1.5, py: 0.4, textTransform: "none" } }}
              >
                <ToggleButton value="all">Any time</ToggleButton>
                <ToggleButton value="week">This week</ToggleButton>
                <ToggleButton value="month">This month</ToggleButton>
              </ToggleButtonGroup>
              {hasFilters && (
                <Button size="small" onClick={() => { setSearch(""); setCategory("All"); setDateFilter("all"); }} sx={{ fontSize: 11.5 }}>
                  Clear
                </Button>
              )}
            </Box>
            {hasFilters && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {filtered.length === 0 ? "No results found." : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
              </Typography>
            )}
          </Paper>

          {/* Results */}
          {loading ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography variant="body2" color="text.secondary">Loading announcements…</Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <CampaignOutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight={600}>No announcements found</Typography>
              <Typography variant="body2" color="text.disabled">Try adjusting your search or filters.</Typography>
              <Button variant="outlined" sx={{ mt: 2 }} onClick={() => { setSearch(""); setCategory("All"); setDateFilter("all"); }}>
                Clear Filters
              </Button>
            </Box>
          ) : (
            <Box>
              {/* Pinned section */}
              {pinned.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                    <PushPinOutlinedIcon sx={{ fontSize: 13, color: "secondary.main" }} />
                    <Typography variant="overline" color="secondary.main" fontWeight={700} sx={{ fontSize: 10 }}>
                      Pinned Announcements
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {pinned.map((a) => (
                      <AnnouncementCard
                        key={a.id} ann={a}
                        active={selectedId === a.id}
                        onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                      />
                    ))}
                  </Box>
                  {regular.length > 0 && <Divider sx={{ my: 2 }} />}
                </Box>
              )}

              {/* Regular */}
              {regular.length > 0 && (
                <Box>
                  {pinned.length > 0 && (
                    <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, mb: 1, display: "block" }}>
                      All Announcements
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {regular.map((a) => (
                      <AnnouncementCard
                        key={a.id} ann={a}
                        active={selectedId === a.id}
                        onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* ── Right: Detail pane ───────────────────── */}
        {selected && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <AnnouncementDetail ann={selected} onClose={() => setSelectedId(null)} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

