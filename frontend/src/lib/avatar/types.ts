/**
 * AvatarProvider — vendor-agnostic interface for the visual + voice layer of
 * the AI avatar. Implementations plug into `AvatarProviderFactory`. The rest
 * of the app talks only to this interface so a provider swap is a one-file
 * change.
 */

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "error";

/** Called every animation frame while the avatar is speaking, with a 0..1
 * normalized mouth-openness value derived from the current audio energy.
 * Providers that render their own talking-head video simply ignore this. */
export type MouthLevelCallback = (level: number) => void;

export type AvatarProviderInit = {
  /** Absolute or root-relative URL to the profile photo. */
  photoUrl: string;
  /** Preferred voice id (provider-specific). */
  voiceId?: string | null;
  /** When true, the provider MAY call `/api/avatar/tts` for server-side voice.
   * When false, use browser `speechSynthesis`. */
  serverTtsAvailable: boolean;
};

export type SpeakOptions = {
  /** The text the avatar will say. */
  text: string;
  /** Optional AbortSignal — canceling stops audio + animation cleanly. */
  signal?: AbortSignal;
  /** Called on each animation frame with 0..1 mouth-openness. Ignored by
   * providers that render their own talking-head video. */
  onMouthLevel?: MouthLevelCallback;
  /** State transitions the provider observes so the UI stays in sync. */
  onState?: (s: AvatarState) => void;
};

export interface AvatarProvider {
  /** Provider identifier, used for feature-detection in the UI. */
  readonly kind: "browser-photo" | "did" | "heygen" | "simli";

  /** Lazy initialize any audio graphs, video streams, or session tokens.
   * Called from a user gesture so browsers allow audio. */
  init(config: AvatarProviderInit): Promise<void>;

  /** Speak the given text and drive the mouth animation. Resolves when the
   * spoken audio finishes (or is aborted). */
  speak(opts: SpeakOptions): Promise<void>;

  /** Immediately stop any in-flight audio / animation. Safe to call
   * repeatedly. */
  stop(): void;

  /** Global mute toggle. Muted playback still counts as "spoken" — the
   * mouth animation continues but no audio plays. */
  setMuted(muted: boolean): void;

  /** Release all resources (audio contexts, streams, sockets). */
  dispose(): void;
}
