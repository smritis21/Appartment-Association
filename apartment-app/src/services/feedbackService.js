/**
 * feedbackService.js - FE-20 / BE-20.
 *
 * Talks to the Complaint Feedback API and translates between the backend's
 * snake_case contract and the camelCase shape the feedback screens use.
 *
 * Endpoints used:
 *   POST /complaints/{id}/feedback   - store a rating and optional comment
 *   GET  /complaints/{id}/feedback   - read the stored feedback back
 *
 * Also exports the feedback-window helpers. The window rule is duplicated
 * here on purpose: the backend is the authority and will return 410 either
 * way, but re-checking client-side means the UI can grey out an expired
 * complaint and say when it closed, instead of letting someone pick a rating,
 * write a comment and only then be told they were too late.
 */

import apiClient from "./apiClient";

/**
 * Must match complaint_service.FEEDBACK_WINDOW_DAYS. If the backend value
 * changes, change it here too - the mismatch would show up as the UI offering
 * a rating the API then rejects with 410.
 */
export const FEEDBACK_WINDOW_DAYS = 14;

/** Statuses a complaint must be in before it can be rated. */
const RATEABLE_STATUSES = ["resolved", "closed"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Backend ComplaintFeedbackOut -> UI shape. */
export function toUiFeedback(dto) {
  if (!dto) return null;
  return {
    id: dto.feedback_id,
    complaintId: dto.complaint_id,
    rating: dto.rating,
    comment: dto.comment ?? null,
    submittedBy: dto.submitted_by ?? null,
    submittedAt: dto.submitted_at,
  };
}

/**
 * When a complaint's work was finished - the anchor for the feedback window.
 *
 * Mirrors the backend rule: the earliest timeline entry that moved the
 * complaint into resolved/closed, falling back to its creation date when
 * there is no such entry. Deliberately does not use a "last updated" field,
 * because that moves on any edit and would silently shift the window.
 */
export function resolutionDate(complaint) {
  const entry = (complaint?.timeline ?? []).find((t) =>
    RATEABLE_STATUSES.includes(t.status)
  );
  const raw = entry?.at ?? complaint?.resolvedAt ?? complaint?.createdAt;
  return raw ? new Date(raw) : null;
}

/** The moment the feedback window closes for a complaint, or null. */
export function feedbackDeadline(complaint) {
  const resolved = resolutionDate(complaint);
  if (!resolved || Number.isNaN(resolved.getTime())) return null;
  return new Date(resolved.getTime() + FEEDBACK_WINDOW_DAYS * MS_PER_DAY);
}

/**
 * Window state for one complaint, ready for display.
 *
 * @returns {{ rateable: boolean, open: boolean, deadline: Date|null, daysLeft: number|null, reason: string|null }}
 *   rateable - resolved/closed and not yet rated
 *   open     - rateable AND still inside the window
 *   reason   - why it can't be rated, phrased for the user
 */
export function feedbackWindow(complaint, now = new Date()) {
  if (!complaint) {
    return { rateable: false, open: false, deadline: null, daysLeft: null, reason: null };
  }

  if (!RATEABLE_STATUSES.includes(complaint.status)) {
    return {
      rateable: false,
      open: false,
      deadline: null,
      daysLeft: null,
      reason: "This complaint has not been resolved yet.",
    };
  }

  if (complaint.feedback) {
    return {
      rateable: false,
      open: false,
      deadline: null,
      daysLeft: null,
      reason: "You have already rated this complaint.",
    };
  }

  const deadline = feedbackDeadline(complaint);
  if (!deadline) {
    // No usable resolution date - let the backend be the judge rather than
    // hiding a complaint the resident may legitimately be able to rate.
    return { rateable: true, open: true, deadline: null, daysLeft: null, reason: null };
  }

  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft <= 0) {
    return {
      rateable: true,
      open: false,
      deadline,
      daysLeft: 0,
      reason: `The ${FEEDBACK_WINDOW_DAYS}-day feedback window closed on ${deadline.toLocaleDateString()}.`,
    };
  }

  return {
    rateable: true,
    open: true,
    deadline,
    daysLeft: Math.max(1, Math.ceil(msLeft / MS_PER_DAY)),
    reason: null,
  };
}

/**
 * Submit a rating for a complaint.
 *
 * @param {string} complaintId
 * @param {{ rating: number, comment?: string, submittedBy?: string }} feedback
 * @returns the stored feedback in UI shape
 *
 * Errors surfaced to the caller as ApiError:
 *   400 - the complaint is not resolved/closed yet
 *   409 - it has already been rated
 *   410 - the feedback window has closed
 *   422 - rating missing or outside 1–5
 */
export async function submitFeedback(complaintId, { rating, comment, submittedBy }) {
  const payload = { rating };
  if (comment && comment.trim()) payload.comment = comment.trim();
  if (submittedBy) payload.submitted_by = submittedBy;

  const data = await apiClient.post(
    `/complaints/${encodeURIComponent(complaintId)}/feedback`,
    payload
  );
  return toUiFeedback(data);
}

/** Read the feedback stored for a complaint. Throws ApiError 404 if unrated. */
export async function fetchFeedback(complaintId) {
  const data = await apiClient.get(
    `/complaints/${encodeURIComponent(complaintId)}/feedback`
  );
  return toUiFeedback(data);
}

