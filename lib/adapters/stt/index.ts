export interface SpeechToText {
  readonly name: string;
  transcribe(input: { data: Buffer; mimeType: string; language: "en" | "hi" }): Promise<{ text: string; seconds: number }>;
}

/** Mock: the simulator encodes the "spoken" text as the audio bytes. */
export class MockSpeechToText implements SpeechToText {
  readonly name = "mock";
  async transcribe(input: { data: Buffer }) {
    const text = input.data.toString("utf8");
    return { text, seconds: Math.max(3, Math.round(text.split(/\s+/).length / 2.5)) };
  }
}
// A real provider (to be chosen after the Hindi accuracy test in TODO.md) implements the same interface.
