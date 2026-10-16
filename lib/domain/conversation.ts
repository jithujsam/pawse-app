import { copy, type Lang } from "./copy";
import type { ConversationState } from "../db/schema";

export type EngineState = {
  state: ConversationState;
  currentQuestion: number; // index of the question being asked
  repromptCount: number; // off-script replies to the current prompt
  lateReplyNotified: boolean;
};

export type EngineInput = {
  kind: "text" | "voice" | "other";
  text: string; // message text or voice transcript
  questions: string[];
  jobOpen: boolean;
  language: Lang;
};

export type Effect =
  | { type: "reply"; body: string }
  | { type: "record_answer"; questionIndex: number; text: string; source: "text" | "voice" }
  | { type: "completed" }
  | { type: "opted_out" }
  | { type: "declined" }
  | { type: "needs_human"; reason: string }
  | { type: "deletion_requested" };

export type Intent = "stop" | "delete" | "yes" | "no" | "repeat" | "confused" | "filler" | "answer";

/** Re-ask this many times before handing the candidate to a human. */
export const MAX_REPROMPTS = 1;

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.!?,;:"'()।]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classify(text: string, kind: EngineInput["kind"]): Intent {
  if (kind === "other") return "filler";
  const t = norm(text);
  if (!t || !/[\p{L}\p{N}]/u.test(t)) return "filler";
  const words = t.split(" ");
  const short = words.length <= 6;
  if (short && /^(stop|unsubscribe|band karo|bandh karo|stop karo|बंद करो|बंद|रोको)\b/.test(t)) return "stop";
  if (short && /\b(delete|mitao|हटाओ|डिलीट)\b/.test(t)) return "delete";
  if (/^(yes|y|yeah|yep|haan|haa|ha|han|ji|ji haan|sure|ok yes|हाँ|हां|जी|जी हाँ|1)$/.test(t)) return "yes";
  if (/^(no|n|nope|nahi|nahin|na|नहीं|ना|2)$/.test(t)) return "no";
  if (
    short &&
    /(\brepeat\b|\bdobara\b|\bphir se\b|फिर से|दोबारा|\bsay again\b|\bquestion again\b|^again$|what was the question|^question$|^sawal$)/.test(t)
  )
    return "repeat";
  if (
    short &&
    /(don t understand|dont understand|didn t understand|didnt understand|not clear|samajh nahi|samjha nahi|समझ नहीं|^what$|^kya$|^क्या$)/.test(t)
  )
    return "confused";
  if (/^(ok|okay|k|hmm+|hi|hello|hey|thanks|thank you|👍)$/.test(t)) return "filler";
  return "answer";
}

/**
 * Pure state machine for one inbound message. The caller persists the new
 * state and turns effects into messages, answers and status changes.
 */
export function step(s: EngineState, input: EngineInput): { next: EngineState; effects: Effect[] } {
  const c = copy(input.language);
  const intent = classify(input.text, input.kind);
  const n = input.questions.length;
  const next: EngineState = { ...s };
  const effects: Effect[] = [];
  const reply = (body: string) => effects.push({ type: "reply", body });
  const ask = (i: number) => reply(c.question(i + 1, n, input.questions[i]));

  // Deletion and opt-out are honoured in every state.
  if (intent === "delete") {
    next.state = "opted_out";
    effects.push({ type: "deletion_requested" }, { type: "opted_out" });
    reply(c.deleted);
    return { next, effects };
  }
  if (s.state === "opted_out") return { next, effects }; // never message after STOP
  if (intent === "stop") {
    next.state = "opted_out";
    effects.push({ type: "opted_out" });
    reply(c.stopped);
    return { next, effects };
  }
  if (s.state === "needs_human") return { next, effects }; // recruiter replies manually

  const open = s.state !== "done";
  if (!input.jobOpen && open) {
    if (!s.lateReplyNotified) {
      next.lateReplyNotified = true;
      reply(c.closed);
    }
    return { next, effects };
  }

  const reprompt = (body: string, reason: string) => {
    if (s.repromptCount < MAX_REPROMPTS) {
      next.repromptCount = s.repromptCount + 1;
      reply(body);
    } else {
      next.state = "needs_human";
      effects.push({ type: "needs_human", reason });
      reply(c.handoff);
    }
  };

  // A candidate who went quiet resumes where they left off.
  const state: ConversationState =
    s.state === "no_response" ? (s.currentQuestion > 0 ? "asking" : "awaiting_optin") : s.state;
  if (state !== s.state) next.state = state;

  switch (state) {
    case "awaiting_optin":
    case "declined": {
      if (intent === "yes") {
        next.state = "asking";
        next.currentQuestion = 0;
        next.repromptCount = 0;
        reply(c.start(n));
        ask(0);
      } else if (intent === "no") {
        if (state !== "declined") {
          next.state = "declined";
          effects.push({ type: "declined" });
          reply(c.declined);
        }
      } else if (state === "awaiting_optin") {
        reprompt(c.optinReprompt, "Did not reply YES or STOP to the invite");
      }
      return { next, effects };
    }
    case "asking": {
      const q = input.questions[s.currentQuestion];
      const qLine = c.question(s.currentQuestion + 1, n, q);
      if (intent === "repeat") {
        ask(s.currentQuestion);
      } else if (intent === "confused") {
        reprompt(c.rephrase(qLine), `Did not understand question ${s.currentQuestion + 1}`);
      } else if (intent === "filler" || intent === "yes" || intent === "no") {
        // A bare yes/no is a valid answer to a yes/no question, so only treat it
        // as off-script when the question is open-ended.
        if ((intent === "yes" || intent === "no") && isYesNoQuestion(q)) {
          recordAndAdvance();
        } else {
          reprompt(c.offScript(qLine), `Off-script reply to question ${s.currentQuestion + 1}`);
        }
      } else {
        recordAndAdvance();
      }
      return { next, effects };
    }
    case "done": {
      if (!s.lateReplyNotified) {
        next.lateReplyNotified = true;
        reply(c.late);
      }
      return { next, effects };
    }
    default:
      return { next, effects };
  }

  function recordAndAdvance() {
    effects.push({
      type: "record_answer",
      questionIndex: s.currentQuestion,
      text: input.text.trim().slice(0, 4000),
      source: input.kind === "voice" ? "voice" : "text",
    });
    next.repromptCount = 0;
    if (s.currentQuestion + 1 < n) {
      next.currentQuestion = s.currentQuestion + 1;
      ask(next.currentQuestion);
    } else {
      next.state = "done";
      effects.push({ type: "completed" });
      reply(c.done);
    }
  }
}

export function isYesNoQuestion(q: string) {
  return /^(are|do|did|have|has|can|will|is|would|could|kya)\b/i.test(q.trim());
}
