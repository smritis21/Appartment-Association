// INT-30: Marketplace - live API integration
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Grid,
  MenuItem, Paper, Snackbar, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchListings, createListing, markListingSold,
  addToWishlist, removeFromWishlist, fetchWishlist,
} from "../../../services/marketplaceService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { mockProducts, PRODUCT_CATEGORIES, PRODUCT_STATUS } from "../mock/products";
import ProductCard from "../components/ProductCard";
import ListProductForm from "../components/ListProductForm";
import PageHeader from "../../../components/common/PageHeader";
import SearchBar from "../../../components/common/SearchBar";
import EmptyState from "../../../components/common/EmptyState";
import { useAuth } from "../../../hooks/useAuth";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";

export default function MarketplacePage() {
  const { user } = useAuth();
  const residentId = user?.residentId ?? user?.resident_id ?? null;

  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const notify = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const load = useCallback(async () => {
    try {
      const [listings, wl] = await Promise.all([
        fetchListings(),
        residentId ? fetchWishlist(residentId).catch(() => []) : Promise.resolve([]),
      ]);
      setProducts(listings);
      setWishlistIds(new Set(wl.map((l) => l.id)));
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setProducts(mockProducts);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [residentId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const isMine = p.residentId === residentId || p.seller?.flat === user?.flat;
      if (tab === "mine"     && !isMine) return false;
      if (tab === "wishlist" && !wishlistIds.has(p.id)) return false;
      if (tab === "browse"   && isMine)  return false;
      // In browse, hide sold items
      if (tab === "browse"   && (p.status === "sold" || p.status === PRODUCT_STATUS.SOLD)) return false;
      const matchQ = (p.title ?? "").toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
      const matchC = category === "all" || p.category === category;
      return matchQ && matchC;
    });
  }, [products, tab, search, category, wishlistIds, residentId, user]);

  const handleList = async (data) => {
    if (offline) {
      // Fallback: add locally
      setProducts((prev) => [{
        id: `MKT-LOCAL-${Date.now()}`,
        residentId,
        ...data,
        seller: { name: user?.name ?? "Resident", flat: user?.flat ?? "-", phone: user?.phone ?? "" },
        listedAt: new Date().toISOString().slice(0, 10),
        status: PRODUCT_STATUS.AVAILABLE,
        wishlistCount: 0,
      }, ...prev]);
      setFormOpen(false);
      setTab("mine");
      notify(`"${data.title}" listed for ${formatCurrency(data.price)}.`);
      return;
    }
    try {
      await createListing({ residentId, ...data });
      await load();
      setFormOpen(false);
      setTab("mine");
      notify(`"${data.title}" listed for ${formatCurrency(data.price)}.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : "Failed to list item.", "error");
    }
  };

  const handleMarkSold = async (product) => {
    if (offline) {
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, status: PRODUCT_STATUS.SOLD } : p));
      setViewing(null);
      notify(`"${product.title}" marked as sold.`, "info");
      return;
    }
    try {
      await markListingSold(product.id, residentId);
      await load();
      setViewing(null);
      notify(`"${product.title}" marked as sold.`, "info");
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : "Failed to mark as sold.", "error");
    }
  };

  const toggleWish = async (product) => {
    if (offline) {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        next.has(product.id) ? next.delete(product.id) : next.add(product.id);
        return next;
      });
      return;
    }
    const wished = wishlistIds.has(product.id);
    try {
      if (wished) {
        await removeFromWishlist(product.id, residentId);
      } else {
        await addToWishlist(product.id, residentId);
      }
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : "Wishlist update failed.", "error");
    }
  };

  const wished = viewing && wishlistIds.has(viewing.id);
  const isMine = (p) => p.residentId === residentId || p.seller?.flat === user?.flat;

  return (
    <Box>
      <PageHeader
        title="Marketplace"
        subtitle="Buy and sell within the community"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Marketplace" }]}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
            List an Item
          </Button>
        }
      />

      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..." sx={{ flex: 1, minWidth: 200 }} />
          <TextField select size="small" label="Category" value={category}
            onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">All Categories</MenuItem>
            {PRODUCT_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tab value="browse"   label="Browse" />
        <Tab value="mine"     label="My Listings" />
        <Tab value="wishlist" label={`Wishlist (${wishlistIds.size})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : visible.length === 0 ? (
        <EmptyState icon={StorefrontOutlinedIcon} title="Nothing here yet"
          description={
            tab === "wishlist" ? "Tap the heart on an item to save it here."
            : tab === "mine"   ? "Items you list for sale will appear here."
            : "No items match your search. Try a different category."
          }
          action={tab === "mine" ? () => setFormOpen(true) : undefined}
          actionLabel={tab === "mine" ? "List an Item" : undefined}
        />
      ) : (
        <Grid container spacing={2}>
          {visible.map((product) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={product.id}>
              <ProductCard product={product} wished={wishlistIds.has(product.id)}
                onOpen={setViewing} onToggleWish={toggleWish} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Item detail */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="xs" fullWidth>
        {viewing && (
          <>
            <DialogTitle sx={{ fontWeight: 700, pr: 6 }}>
              {viewing.title}
              <Typography variant="caption" color="text.secondary" display="block">
                {viewing.category} · listed {formatDate(viewing.listedAt)}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="h5" fontWeight={700} color="primary.main" gutterBottom>
                {formatCurrency(viewing.price)}
                {(viewing.status === "sold" || viewing.status === PRODUCT_STATUS.SOLD) && (
                  <Chip label="Sold" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{viewing.description}</Typography>
              <Box sx={{ p: 1.5, bgcolor: "background.default", borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block">Seller</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {viewing.seller?.name ?? viewing.residentId} · Flat {viewing.seller?.flat ?? "-"}
                </Typography>
                {viewing.seller?.phone && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, color: "primary.main" }}>
                    <PhoneOutlinedIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2" fontWeight={600} fontFamily="var(--font-mono)">{viewing.seller.phone}</Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <Button color="inherit" variant="outlined"
                startIcon={wished ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                onClick={() => toggleWish(viewing)}>
                {wished ? "Saved" : "Wishlist"}
              </Button>
              {isMine(viewing) && viewing.status !== "sold" && viewing.status !== PRODUCT_STATUS.SOLD && (
                <Button variant="contained" color="info" startIcon={<SellOutlinedIcon />}
                  onClick={() => handleMarkSold(viewing)}>
                  Mark as Sold
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>List an Item for Sale</DialogTitle>
        <DialogContent>
          <ListProductForm onList={handleList} onCancel={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

