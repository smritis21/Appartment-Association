/**
 * marketplaceService.js - BE-30.
 *
 * Talks to the Marketplace API and translates between the backend's
 * snake_case contract and the camelCase shape MarketplacePage uses.
 *
 * Endpoints used:
 *   GET  /marketplace/listings                        - list listings
 *   POST /marketplace/listings                        - create listing
 *   GET  /marketplace/listings/{id}                   - get listing
 *   PUT  /marketplace/listings/{id}/sold              - mark sold
 *   POST /marketplace/listings/{id}/wishlist          - add to wishlist
 *   DELETE /marketplace/listings/{id}/wishlist/{rid}  - remove from wishlist
 *   GET  /marketplace/residents/{rid}/wishlist        - get wishlist
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

export function toUiListing(dto) {
  return {
    id:           dto.listing_id,
    residentId:   dto.resident_id,
    title:        dto.title,
    description:  dto.description ?? "",
    price:        Number(dto.price),
    category:     dto.category,
    imageUrl:     dto.image_url ?? null,
    status:       dto.status,          // "available" | "sold"
    wishlistCount:dto.wishlist_count ?? 0,
    listedAt:     dto.listed_at,
    updatedAt:    dto.updated_at,
  };
}

// ── Listings ──────────────────────────────────────────────────────────────────

export async function fetchListings({ category, status, residentId } = {}, options = {}) {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (status)     params.set("status", status);
  if (residentId) params.set("resident_id", residentId);
  const data = await apiClient.get(`/marketplace/listings?${params}`, options);
  return (data ?? []).map(toUiListing);
}

export async function createListing({ residentId, title, description, price, category, imageUrl } = {}, options = {}) {
  const body = { resident_id: residentId, title, price, category };
  if (description) body.description = description;
  if (imageUrl)    body.image_url = imageUrl;
  const data = await apiClient.post("/marketplace/listings", body, options);
  return toUiListing(data);
}

export async function getListing(listingId, options = {}) {
  const data = await apiClient.get(`/marketplace/listings/${encodeURIComponent(listingId)}`, options);
  return toUiListing(data);
}

export async function markListingSold(listingId, residentId, options = {}) {
  const data = await apiClient.put(
    `/marketplace/listings/${encodeURIComponent(listingId)}/sold`,
    { resident_id: residentId },
    options
  );
  return toUiListing(data);
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

export async function addToWishlist(listingId, residentId, options = {}) {
  const data = await apiClient.post(
    `/marketplace/listings/${encodeURIComponent(listingId)}/wishlist`,
    { resident_id: residentId },
    options
  );
  return data;
}

export async function removeFromWishlist(listingId, residentId, options = {}) {
  return apiClient.delete(
    `/marketplace/listings/${encodeURIComponent(listingId)}/wishlist/${encodeURIComponent(residentId)}`,
    options
  );
}

export async function fetchWishlist(residentId, options = {}) {
  const data = await apiClient.get(
    `/marketplace/residents/${encodeURIComponent(residentId)}/wishlist`,
    options
  );
  return (data ?? []).map(toUiListing);
}

