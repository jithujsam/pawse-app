// Candidate-facing WhatsApp copy. Hindi strings need review by a native speaker (TODO.md).
export type Lang = "en" | "hi";

export const PRIVACY_NOTICE_VERSION = "2026-10-v1";

export function inviteText(lang: Lang, p: { org: string; role: string; days: number; privacyUrl: string }) {
  return lang === "hi"
    ? `${p.org} ${p.role} पद के लिए भर्ती कर रहा है। 5 छोटे सवालों के जवाब देने के लिए YES लिखें (टेक्स्ट या वॉइस नोट)। मैसेज बंद करने के लिए कभी भी STOP लिखें। आपके जवाब सिर्फ़ इसी पद के लिए इस्तेमाल होंगे और ${p.days} दिन बाद हटा दिए जाएंगे। प्राइवेसी: ${p.privacyUrl}`
    : `${p.org} is hiring for ${p.role}. Reply YES to answer 5 short questions (text or voice note). Reply STOP at any time to opt out. Your answers are used only for this role and deleted after ${p.days} days. Privacy: ${p.privacyUrl}`;
}

/** Ordered parameters for the approved WhatsApp template body. */
export function inviteParams(p: { org: string; role: string; days: number; privacyUrl: string }) {
  return [p.org, p.role, String(p.days), p.privacyUrl];
}

export function reminderText(lang: Lang, p: { org: string; role: string }) {
  return lang === "hi"
    ? `${p.org} की ओर से ${p.role} पद के बारे में याद दिला रहे हैं। जारी रखने के लिए YES लिखें या STOP लिखें।`
    : `A reminder from ${p.org} about the ${p.role} role. Reply YES to continue, or STOP to opt out.`;
}

const T = {
  en: {
    start: (n: number) => `Thanks! There are ${n} questions. Answer each one by text or a voice note.`,
    question: (i: number, n: number, q: string) => `Question ${i}/${n}: ${q}`,
    rephrase: (q: string) => `No problem. Please answer in your own words, by text or voice note. ${q}`,
    offScript: (q: string) => `Sorry, we couldn't read that as an answer. ${q}`,
    optinReprompt: "Please reply YES to start the questions, or STOP if you don't want messages.",
    handoff: "Thanks. A recruiter will contact you directly.",
    declined: "No problem, thank you for your time. Reply YES if you change your mind.",
    done: "Thank you! Your answers have been sent to the recruiter. They will contact you if you are shortlisted.",
    late: "We already have your answers, thank you. The recruiter will contact you if you are shortlisted.",
    closed: "This role is now closed. Thank you for your interest.",
    stopped: "You won't receive any more messages about this role.",
    deleted: "Your request is recorded. Your answers and details for this role have been deleted.",
  },
  hi: {
    start: (n: number) => `धन्यवाद! कुल ${n} सवाल हैं। हर सवाल का जवाब टेक्स्ट या वॉइस नोट में दें।`,
    question: (i: number, n: number, q: string) => `सवाल ${i}/${n}: ${q}`,
    rephrase: (q: string) => `कोई बात नहीं। अपने शब्दों में टेक्स्ट या वॉइस नोट से जवाब दें। ${q}`,
    offScript: (q: string) => `माफ़ कीजिए, हम इसे जवाब के रूप में नहीं पढ़ पाए। ${q}`,
    optinReprompt: "सवाल शुरू करने के लिए YES लिखें, या मैसेज नहीं चाहिए तो STOP लिखें।",
    handoff: "धन्यवाद। एक रिक्रूटर आपसे सीधे संपर्क करेंगे।",
    declined: "कोई बात नहीं, आपके समय के लिए धन्यवाद। मन बदले तो YES लिखें।",
    done: "धन्यवाद! आपके जवाब रिक्रूटर को भेज दिए गए हैं। शॉर्टलिस्ट होने पर वे आपसे संपर्क करेंगे।",
    late: "आपके जवाब हमें मिल चुके हैं, धन्यवाद। शॉर्टलिस्ट होने पर रिक्रूटर संपर्क करेंगे।",
    closed: "यह पद अब बंद हो चुका है। आपकी रुचि के लिए धन्यवाद।",
    stopped: "अब आपको इस पद के बारे में कोई मैसेज नहीं मिलेगा।",
    deleted: "आपका अनुरोध दर्ज हो गया है। इस पद के लिए आपके जवाब और जानकारी हटा दी गई है।",
  },
} as const;

export function copy(lang: Lang) {
  return T[lang] ?? T.en;
}
