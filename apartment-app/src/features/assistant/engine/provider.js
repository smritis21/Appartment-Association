import { answerQuery } from "./localEngine";
import { sendMessage } from "../../../services/assistantService";
import { isOffline } from "../../../services/apiClient";

/**
 * Single entry point the chat UI calls.
 *
 * The assistant runs on the server: it classifies the message, extracts the
 * details it needs, and either answers, asks for what is missing, or proposes
 * an action to be confirmed. That is where the database is, so it is the only
 * place that can answer from real records or act on them.
 *
 * The local engine stays as a fallback for when the server cannot be reached,
 * so the screen still responds instead of failing - but its answers come from
 * static data, which is why the reply says so.
 */

/** Server reply -> the shape ChatBubble renders. */
function toAnswer(reply) {
  const base = {
    text: reply.text || "",
    sources: reply.source === "rules" ? ["Live data"] : reply.source ? [reply.source] : [],
  };

  switch (reply.kind) {
    case "proposal":
      // Carries the action so the page can offer Confirm / Cancel.
      return { ...base, kind: "text", action: reply.action };
    case "needs_input":
      // The assistant is mid-request and waiting on one more detail.
      return { ...base, kind: "text", awaitingInput: reply.missing ?? [] };
    case "navigate":
      return { ...base, kind: "text", route: reply.route, destination: reply.destination };
    case "fallback":
      return { ...base, kind: "text", suggestions: reply.suggestions ?? [] };
    default:
      return { ...base, kind: "text", data: reply.data };
  }
}

export async function askAssistant(query, context = {}) {
  try {
    const reply = await sendMessage(query, context.conversationId);
    return { ...toAnswer(reply), conversationId: reply.conversation_id ?? context.conversationId };
  } catch (err) {
    if (!isOffline(err)) {
      // The server answered with a refusal or a validation problem. Saying so
      // is more useful than a canned reply that hides it.
      return {
        kind: "text",
        text: err?.message || "The assistant could not handle that just now.",
        sources: [],
      };
    }
    const local = answerQuery(query, context);
    return {
      ...local,
      text: `${local.text}\n\n(Answered offline from sample data - the server is unreachable.)`,
    };
  }
}

