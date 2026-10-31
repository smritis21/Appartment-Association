/**
 * forumService.js - BE-29.
 *
 * Talks to the Forum & Lost-and-Found API and translates between the
 * backend's snake_case contract and the camelCase shape ForumPage uses.
 *
 * Endpoints used:
 *   POST /forum/posts                        - create a post
 *   GET  /forum/posts                        - list posts
 *   GET  /forum/posts/{post_id}              - get single post
 *   POST /forum/posts/{post_id}/comments     - add a comment
 *   GET  /forum/posts/{post_id}/comments     - list comments
 *   POST /forum/lost-found                   - report lost/found item
 *   GET  /forum/lost-found                   - list lost/found items
 *   PATCH /forum/lost-found/{item_id}/status - update item status
 */

import apiClient from "./apiClient";

// ── Shape translators ─────────────────────────────────────────────────────────

export function toUiPost(dto) {
  return {
    id: dto.post_id,
    title: dto.title,
    body: dto.body,
    category: dto.category,
    imageRefs: dto.image_refs ?? [],
    authorId: dto.author_id ?? null,
    commentCount: dto.comment_count ?? 0,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toUiComment(dto) {
  return {
    id: dto.comment_id,
    postId: dto.post_id,
    body: dto.body,
    authorId: dto.author_id ?? null,
    createdAt: dto.created_at,
  };
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function fetchPosts({ category, skip = 0, limit = 50 } = {}, options = {}) {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category.toLowerCase().replace(/ & /g, "_").replace(/ /g, "_"));
  params.set("skip", skip);
  params.set("limit", limit);
  const data = await apiClient.get(`/forum/posts?${params}`, options);
  return (data?.posts ?? []).map(toUiPost);
}

export async function createPost({ title, body, category, imageRefs = [], authorId = null } = {}, options = {}) {
  // Map UI category labels to backend enum values
  const categoryMap = {
    "General": "general",
    "Suggestions": "general",
    "Lost & Found": "lost_found",
    "Recommendations": "general",
    "Events": "events",
    "Safety": "safety",
    "Classifieds": "classifieds",
  };
  const data = await apiClient.post("/forum/posts", {
    title,
    body,
    category: categoryMap[category] ?? "general",
    image_refs: imageRefs,
    author_id: authorId,
  }, options);
  return toUiPost(data);
}

export async function fetchPost(postId, options = {}) {
  const data = await apiClient.get(`/forum/posts/${encodeURIComponent(postId)}`, options);
  return toUiPost(data);
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function createComment(postId, { body, authorId = null } = {}, options = {}) {
  const data = await apiClient.post(
    `/forum/posts/${encodeURIComponent(postId)}/comments`,
    { body, author_id: authorId },
    options
  );
  return toUiComment(data);
}

export async function fetchComments(postId, { skip = 0, limit = 50 } = {}, options = {}) {
  const data = await apiClient.get(
    `/forum/posts/${encodeURIComponent(postId)}/comments?skip=${skip}&limit=${limit}`,
    options
  );
  return (data?.comments ?? []).map(toUiComment);
}

