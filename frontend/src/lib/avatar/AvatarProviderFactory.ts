"use client";

import type { AvatarSessionConfig } from "@/lib/api";
import type { AvatarProvider } from "./types";
import { BrowserPhotoProvider } from "./providers/BrowserPhotoProvider";

/**
 * Instantiate the concrete avatar provider based on the server-issued
 * session config. When the backend is configured with a talking-head
 * vendor API key (D-ID, HeyGen, Simli), the response will include a
 * scoped session token and this factory will return the corresponding
 * client adapter. Otherwise we return `BrowserPhotoProvider`, which is a
 * fully working end-to-end fallback (photo + audio-driven lip-sync +
 * TTS).
 *
 * Provider adapters for D-ID / HeyGen / Simli are intentionally NOT
 * shipped in this initial cut — plugging one in is a matter of dropping
 * a file into `./providers/` that implements the `AvatarProvider`
 * interface and adding a case here.
 */
export function createAvatarProvider(config: AvatarSessionConfig): AvatarProvider {
  switch (config.provider) {
    case "did":
    case "heygen":
    case "simli":
      // Talking-head provider adapters plug in here. Falling back to the
      // browser-photo provider is safe until they're implemented — the
      // rest of the app is fully vendor-neutral.
      return new BrowserPhotoProvider();
    case "browser-photo":
    default:
      return new BrowserPhotoProvider();
  }
}
