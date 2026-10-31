import { Box, Button, Chip, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import ChatBubble from "../components/ChatBubble";
import { askAssistant } from "../engine/provider";
import { useAuth } from "../../../hooks/useAuth";
import { confirmAction, rejectAction } from "../../../services/assistantService";

// Kept honest on purpose: each of these is something the assistant can
// actually answer or do from live data. Promising more than that is what
// makes an assistant feel broken.
const STARTERS = [
  "What can I complain about?",
  "Have I raised any complaints?",
  "What facilities can I book?",
  "How much do I owe?",
  "My tap is leaking in A-402",
];

export default function AssistantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  // Ties follow-up messages to the same request, so answering "A-402" after
  // "my tap is leaking" completes one complaint instead of starting over.
  const [conversationId, setConversationId] = useState(null);
  const [working, setWorking] = useState(false);

  const context = useMemo(() => ({ user, conversationId }), [user, conversationId]);

  useEffect(() => {
    setMessages([{ role: "assistant", answer: {
      kind: "help",
      text: `Hi${user?.name ? ` ${user.name.split(" ")[0]}` : ""}! I can look up your complaints, dues, visitors and bookings, raise a complaint or a visitor pass for you, and take you to any screen. Just say what you need.`,
    } }]);
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text) => {
    const query = text.trim();
    if (!query || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: query }]);
    setThinking(true);
    const answer = await askAssistant(query, context);
    setThinking(false);
    if (answer.conversationId) setConversationId(answer.conversationId);
    setMessages((m) => [...m, { role: "assistant", answer }]);

    // Asking to be taken somewhere should actually take you there. The short
    // pause lets the confirmation ("Opening Complaints.") be read first.
    if (answer.route) {
      setTimeout(() => navigate(answer.route), 600);
    }
  };

  /**
   * Carry out (or drop) an action the assistant proposed.
   *
   * The proposal is replaced by its outcome so the buttons cannot be pressed
   * twice, and the result comes from the server rather than being assumed.
   */
  const resolveAction = async (index, actionId, accept) => {
    if (working) return;
    setWorking(true);
    try {
      const result = accept ? await confirmAction(actionId) : await rejectAction(actionId);
      setMessages((m) => m.map((entry, i) => (
        i === index ? { ...entry, answer: { ...entry.answer, action: null, resolved: true } } : entry
      )));
      setMessages((m) => [...m, { role: "assistant", answer: {
        kind: "text",
        text: accept
          ? (result?.summary || "Done.")
          : "No problem - I have not done anything.",
        sources: accept ? ["Live data"] : [],
      } }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", answer: {
        kind: "text",
        text: err?.message || "That action could not be completed.",
      } }]);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Community Assistant"
        subtitle="Ask about your complaints, dues, bookings and visitors - or ask me to raise one for you"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Community Assistant" }]}
      />

      <Paper elevation={1} sx={{ borderRadius: 3, display: "flex", flexDirection: "column", height: "calc(100vh - 240px)", minHeight: 420, overflow: "hidden" }}>
        <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 2, md: 3 } }}>
          {messages.map((m, i) => (
            <Box key={i}>
              <ChatBubble message={m} />
              {/* An action is only carried out when the user says so, so the
                  proposal sits here until it is confirmed or dropped. */}
              {m.answer?.action && (
                <Box sx={{ display: "flex", gap: 1, pl: 5.5, mt: -0.5, mb: 1.5 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={working}
                    onClick={() => resolveAction(i, m.answer.action.action_id, true)}
                  >
                    {working ? "Working…" : "Confirm"}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={working}
                    onClick={() => resolveAction(i, m.answer.action.action_id, false)}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </Box>
          ))}

          {thinking && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", pl: 5.5 }}>
              <SmartToyOutlinedIcon fontSize="small" />
              <Typography variant="caption">Assistant is typing…</Typography>
            </Box>
          )}

          {messages.length <= 1 && !thinking && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mt: 2, pl: 5.5 }}>
              {STARTERS.map((s) => (
                <Chip key={s} label={s} onClick={() => send(s)} clickable variant="outlined" sx={{ borderColor: "primary.light" }} />
              ))}
            </Stack>
          )}
          <div ref={endRef} />
        </Box>

        <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", gap: 1, bgcolor: "background.paper" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask the community assistant…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          />
          <IconButton color="primary" onClick={() => send(input)} disabled={!input.trim() || thinking}>
            <SendRoundedIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
}

