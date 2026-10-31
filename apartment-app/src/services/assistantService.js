/**
 * assistantService.js - BE-42 Agentic Assistant.
 *
 * Talks to the assistant API, which is where the real intelligence lives: it
 * classifies the message, pulls out entities, and either answers, asks for the
 * one detail it still needs, or proposes an action for the user to confirm.
 *
 * Endpoints used:
 *   POST /assistant/chat                      - send a message
 *   POST /assistant/actions/{id}/confirm      - carry out a proposed action
 *   POST /assistant/actions/{id}/reject       - discard it
 *   GET  /assistant/tools                     - what this role may ask for
 *
 * Nothing here decides anything on its own. An action is only carried out
 * after the user confirms it, which is why the API proposes rather than acts.
 */

import apiClient from "./apiClient";

/**
 * Send a message.
 *
 * `conversationId` lets the server remember a half-finished request, so
 * "the tap is leaking" followed by "A-402" completes one complaint rather
 * than being read as two unrelated messages.
 */
export async function sendMessage(message, conversationId) {
  return apiClient.post("/assistant/chat", {
    message,
    ...(conversationId ? { conversation_id: conversationId } : {}),
  });
}

/** Carry out an action the assistant proposed. */
export async function confirmAction(actionId) {
  return apiClient.post(`/assistant/actions/${actionId}/confirm`, {});
}

/** Discard a proposed action. */
export async function rejectAction(actionId) {
  return apiClient.post(`/assistant/actions/${actionId}/reject`, {});
}

/** What this user's role is allowed to ask the assistant to do. */
export async function fetchTools() {
  return apiClient.get("/assistant/tools");
}

export default { sendMessage, confirmAction, rejectAction, fetchTools };

