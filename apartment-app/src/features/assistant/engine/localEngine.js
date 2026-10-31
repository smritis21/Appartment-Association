import { ROLES } from "../../../constants/roles";
import { CONTACTS, FACILITIES, RULES, FAQS, SNAPSHOT, directory } from "../mock/knowledge";

// Roles allowed to see another resident's private phone number.
const MANAGEMENT = [ROLES.ADMIN, ROLES.SECRETARY, ROLES.PRESIDENT];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
const has = (q, words) => words.some((w) => q.includes(w));

const SUGGESTIONS = [
  "What's the security gate number?",
  "Gym timings?",
  "Who lives in A-101?",
  "How do I pay maintenance?",
  "How many visitors are on premises?",
];

// Each resolver returns { kind, text, data?, sources?, suggestions? }.
export function answerQuery(rawQuery, context = {}) {
  const q = norm(rawQuery);
  const user = context.user ?? null;

  if (!q) return help();

  if (has(q, ["hi", "hello", "hey", "help", "what can you"])) return help();

  // --- contacts / directory -------------------------------------------------
  if (has(q, ["number", "phone", "contact", "call", "reach"]) || has(q, ["who lives", "who stays", "resident of"])) {
    // A specific flat, e.g. "A-101" or "who lives in a 101"
    const flat = matchFlat(rawQuery);
    if (flat) return residentByFlat(flat, user);

    // A named service desk
    const contact = CONTACTS.find((c) => has(q, [c.key]) || q.includes(norm(c.label)));
    if (contact) {
      return {
        kind: "contact",
        text: `${contact.label} - ${contact.name}`,
        data: [contact],
        sources: ["Society Contacts"],
      };
    }

    // A resident by name
    const person = directory().find((p) => q.includes(norm(p.name).split(" ")[0]));
    if (person) return residentContact(person, user);

    // Generic: show the common desks
    return {
      kind: "contact",
      text: "Here are the main society contacts:",
      data: CONTACTS.slice(0, 4),
      sources: ["Society Contacts"],
      suggestions: SUGGESTIONS,
    };
  }

  // --- facilities -----------------------------------------------------------
  if (has(q, ["gym", "pool", "swimming", "court", "clubhouse", "timing", "timings", "hours", "open", "book"])) {
    const fac = FACILITIES.find((f) => has(q, [f.key]) || (f.key === "pool" && q.includes("swimming")));
    if (fac) {
      return {
        kind: "facility",
        text: `${fac.label} is open ${fac.hours}.`,
        data: fac,
        sources: ["Facilities"],
      };
    }
    return {
      kind: "facilityList",
      text: "Facility timings:",
      data: FACILITIES,
      sources: ["Facilities"],
    };
  }

  // --- dues / bills ---------------------------------------------------------
  if (has(q, ["due", "dues", "owe", "outstanding", "maintenance bill", "how much", "balance"])) {
    const flat = user?.flat;
    const record = flat ? SNAPSHOT.duesByFlat[flat] : null;
    if (record && record.amount > 0) {
      return {
        kind: "dues",
        text: `Flat ${flat} has ₹${record.amount.toLocaleString("en-IN")} due by ${record.dueDate}.`,
        data: { flat, ...record },
        sources: ["Billing"],
        suggestions: ["How do I pay maintenance?"],
      };
    }
    if (record) return { kind: "text", text: `Flat ${flat} has no outstanding dues. You're all clear!`, sources: ["Billing"] };
    return { kind: "text", text: "I couldn't find dues for your flat. Check Payments → Pay Bill for details.", sources: ["Billing"] };
  }

  // --- visitor stats --------------------------------------------------------
  if (has(q, ["visitor", "visitors", "on premise", "on premises", "at the gate", "passes"])) {
    const count = context.stats?.onPremise ?? null;
    if (count != null) {
      return { kind: "stat", text: `There ${count === 1 ? "is" : "are"} currently ${count} visitor${count === 1 ? "" : "s"} on premises.`, sources: ["Visitor Management"] };
    }
    return { kind: "text", text: "You can see live visitor activity under Gate Desk → On Premises.", sources: ["Visitor Management"] };
  }

  // --- rules & FAQ ----------------------------------------------------------
  const rule = RULES.find((r) => has(q, [r.key]) || q.includes(norm(r.topic)));
  if (rule) return { kind: "text", text: rule.text, sources: ["Society Rules"] };

  const faq = FAQS.find((f) => keywordsFor(f.key).some((w) => q.includes(w)));
  if (faq) return { kind: "text", text: faq.text, sources: ["FAQ"] };

  // --- fallback -------------------------------------------------------------
  return {
    kind: "text",
    text: "I'm not sure about that yet. I can help with contacts, facility timings, society rules, your dues, and visitor info.",
    suggestions: SUGGESTIONS,
  };
}

// --- helpers ----------------------------------------------------------------
function help() {
  return {
    kind: "help",
    text: "Hi! I'm the community assistant. Ask me about society contacts, facility timings, rules, your maintenance dues, or visitors.",
    suggestions: SUGGESTIONS,
  };
}

function matchFlat(raw) {
  const m = raw.toUpperCase().match(/\b([A-H])[\s-]?(\d{3})\b/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function residentByFlat(flat, user) {
  const person = directory().find((p) => p.flat === flat);
  if (!person) return { kind: "text", text: `I couldn't find a resident registered to flat ${flat}.`, sources: ["Resident Directory"] };
  return residentContact(person, user, `Flat ${flat} is home to ${person.name}.`);
}

function residentContact(person, user, lead) {
  const canSeePhone = user && MANAGEMENT.includes(user.role);
  const masked = { ...person, phone: canSeePhone ? person.phone : null };
  return {
    kind: "contact",
    text: lead ?? `${person.name} - Flat ${person.flat}`,
    data: [masked],
    sources: ["Resident Directory"],
    privacyNote: canSeePhone ? null : "Private numbers are shared with management only. Contact the Secretary desk to reach a resident.",
  };
}

function keywordsFor(key) {
  return {
    pay: ["pay maintenance", "pay my", "pay bill", "payment"],
    complaint: ["complaint", "complain", "raise issue", "report"],
    visitor: ["visitor pass", "guest pass", "let a visitor", "let visitor", "invite"],
    book: ["book a facility", "book the", "reserve", "booking"],
  }[key] ?? [key];
}

