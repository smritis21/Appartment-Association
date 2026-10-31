// INT-29: Forum - live API integration
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, InputAdornment, Paper, Snackbar, Tab,
  Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import CommentOutlinedIcon from "@mui/icons-material/CommentOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useCallback, useEffect, useState } from "react";
import {
  fetchPosts, createPost, fetchPost, createComment, fetchComments,
} from "../../../services/forumService";
import { isOffline, ApiError } from "../../../services/apiClient";
import {
  getForumPosts, addForumPost, addForumComment,
} from "../mock/communicationData";
import PageHeader from "../../../components/common/PageHeader";
import { useAuth } from "../../../hooks/useAuth";

const CATEGORIES = ["All", "General", "Suggestions", "Lost & Found", "Recommendations"];
const CAT_COLOR = {
  General: "primary", Suggestions: "info", "Lost & Found": "warning", Recommendations: "success",
};

const normalizeCategory = (cat) => {
  if (!cat) return "General";
  const c = String(cat).toLowerCase().trim();
  if (c === "lost_found" || c === "lost & found" || c === "lost and found") return "Lost & Found";
  if (c === "general") return "General";
  if (c === "suggestions" || c === "suggestion") return "Suggestions";
  if (c === "recommendations" || c === "recommendation" || c === "classifieds") return "Recommendations";
  return cat;
};

function timeAgo(date) {
  const diff = (new Date() - new Date(date)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, onClick }) {
  const commentCount = post.commentCount ?? post.comments?.length ?? 0;
  return (
    <Card elevation={1} sx={{ borderRadius: 2, cursor: "pointer", transition: "all 0.15s", "&:hover": { boxShadow: 4, transform: "translateY(-1px)" } }} onClick={onClick}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 1 }}>
          <Chip label={post.category} size="small" color={CAT_COLOR[post.category] ?? "default"} sx={{ height: 20, fontSize: 10 }} />
          <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>{timeAgo(post.createdAt)}</Typography>
        </Box>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ lineHeight: 1.35 }}>{post.title}</Typography>
        <Typography variant="body2" color="text.secondary"
          sx={{ mb: 1.5, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {post.body}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <PersonOutlinedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">{post.authorId ?? post.author ?? "Anonymous"}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <CommentOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">{commentCount}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Post Detail Dialog ─────────────────────────────────────────────────────────
function PostDetailDialog({ postId, offline, onClose, onRefresh }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!postId) return;
    if (offline) {
      const p = getForumPosts().find((x) => x.id === postId);
      if (p) { setPost(p); setComments(p.comments ?? []); }
      return;
    }
    try {
      const [p, cmts] = await Promise.all([fetchPost(postId), fetchComments(postId)]);
      setPost(p);
      setComments(cmts);
    } catch {
      const p = getForumPosts().find((x) => x.id === postId);
      if (p) { setPost(p); setComments(p.comments ?? []); }
    }
  }, [postId, offline]);

  useEffect(() => { load(); }, [load]);

  if (!postId) return null;
  if (!post) return null;

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (offline) {
        addForumComment(postId, { body: comment });
      } else {
        await createComment(postId, { body: comment, authorId: user?.name ?? null });
      }
      setComment("");
      await load();
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!postId} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box>
            <Chip label={post.category} size="small" color={CAT_COLOR[post.category] ?? "default"} sx={{ height: 20, fontSize: 10, mb: 1 }} />
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>{post.title}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <PersonOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          <Typography variant="caption" color="text.secondary">
            {post.authorId ?? post.author ?? "Anonymous"} · {timeAgo(post.createdAt)}
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ lineHeight: 1.75, mb: 2 }}>{post.body}</Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          {comments.length} Comment{comments.length !== 1 ? "s" : ""}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
          {comments.map((c) => (
            <Paper key={c.id ?? c.comment_id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="caption" fontWeight={700}>{c.authorId ?? c.author ?? "Anonymous"}</Typography>
                <Typography variant="caption" color="text.disabled">· {timeAgo(c.createdAt)}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">{c.body}</Typography>
            </Paper>
          ))}
        </Box>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField fullWidth size="small" placeholder="Write a comment…" value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()} />
          <Button variant="contained" onClick={handleComment} disabled={!comment.trim() || submitting} sx={{ flexShrink: 0 }}>
            Post
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Post Dialog ────────────────────────────────────────────────────────
function CreatePostDialog({ open, onClose, onCreated, offline }) {
  const [form, setForm] = useState({ title: "", body: "", category: "General" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const { user } = useAuth();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.body.trim())  e.body  = "Body is required";
    if (form.body.length > 10000) e.body = "Body must be 10 000 characters or fewer";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      if (offline) {
        addForumPost(form);
      } else {
        await createPost({ ...form, authorId: user?.name ?? null });
      }
      setForm({ title: "", body: "", category: "General" });
      setErrors({});
      onCreated();
      onClose();
    } catch (err) {
      setApiError(err instanceof ApiError ? err.detail : "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <ForumOutlinedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>New Post</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>Category</Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {CATEGORIES.slice(1).map((c) => (
                <Chip key={c} label={c} clickable
                  color={form.category === c ? (CAT_COLOR[c] ?? "primary") : "default"}
                  variant={form.category === c ? "filled" : "outlined"}
                  onClick={() => set("category", c)} sx={{ fontSize: 12 }} />
              ))}
            </Box>
          </Box>
          <TextField fullWidth size="small" label="Title" value={form.title}
            onChange={(e) => set("title", e.target.value)}
            error={!!errors.title} helperText={errors.title}
            placeholder="What's this about?" />
          <TextField fullWidth multiline rows={4} label="Body" value={form.body}
            onChange={(e) => set("body", e.target.value)}
            error={!!errors.body} helperText={errors.body || `${form.body.length}/10000`}
            placeholder="Share details, suggestions, or information…" />
          {apiError && <Alert severity="error">{apiError}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>Post</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ForumPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const load = useCallback(async () => {
    try {
      const data = await fetchPosts({ limit: 100 });
      setPosts(data);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setPosts(getForumPosts());
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const countForCategory = (cat) => {
    if (cat === "All") return posts.length;
    return posts.filter((p) => normalizeCategory(p.category) === cat).length;
  };

  const filtered = posts.filter((p) => {
    const norm = normalizeCategory(p.category);
    const matchTab = activeTab === "All" || norm === activeTab;
    const matchSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.body?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <Box>
      <PageHeader
        title="Discussion Forum & Lost & Found"
        subtitle="Community conversations, suggestions, lost items, and local recommendations"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Forum" }]}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Post
          </Button>
        }
      />

      {offline && (
        <Chip icon={<CloudOffOutlinedIcon />} label="Backend unreachable - showing sample data"
          color="warning" variant="outlined" size="small" sx={{ mb: 2 }} />
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2, overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ "& .MuiTab-root": { fontSize: 12.5, minHeight: 44, textTransform: "none", fontWeight: 500 }, "& .Mui-selected": { color: "primary.main", fontWeight: 700 } }}>
            {CATEGORIES.map((c) => (
              <Tab key={c} value={c} label={`${c} (${countForCategory(c)})`} />
            ))}
          </Tabs>
          <TextField size="small" placeholder="Search posts…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment> } }}
            sx={{ mx: 1, my: 0.75, width: 200 }} />
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <ForumOutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={600}>No posts found</Typography>
          <Typography variant="body2" color="text.disabled" gutterBottom>Be the first to start a discussion!</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ mt: 1 }}>Create Post</Button>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 2 }}>
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} onClick={() => setSelectedPostId(p.id)} />
          ))}
        </Box>
      )}

      <PostDetailDialog
        postId={selectedPostId}
        offline={offline}
        onClose={() => setSelectedPostId(null)}
        onRefresh={load}
      />

      <CreatePostDialog
        open={createOpen}
        offline={offline}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          load();
          setToast({ open: true, message: "Post published successfully!", severity: "success" });
        }}
      />

      <Snackbar open={toast.open} autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}

