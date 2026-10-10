import { apiFetch } from "../utils/apiClient";
import { getAuthHeaders } from "./auth";
import { getSafeWindowSpeechSynthesis, getSafeNavigatorLanguage } from "../utils/platform";
/**
 * Voice definitions and speech playback engine
 * Supports:
 * 1. Gemini AI Studio HD Voices (gemini-3.1-flash-tts-preview)
 * 2. Enhanced On-Device System Voices (with intelligent Natural/Neural voice prioritization)
 */

import { safeGetStorage, safeSetStorage, STORAGE_KEYS } from "../utils/storage";

export interface GeminiVoiceOption {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  personality: string;
  description: string;
}

export interface DeviceVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isNatural: boolean;
  isDefault: boolean;
}

export interface SpeechSettings {
  engine: "gemini" | "device";
  geminiVoice: string;
  deviceVoiceURI: string;
  playbackRate: number;
  autoReadResponses: boolean;
  handsFreeMode: boolean;
  silenceTimeoutMs: number;
  sentenceStreaming: boolean;
  voiceButtonPlacement?: "footer" | "fab";
}

export const GEMINI_VOICES: GeminiVoiceOption[] = [
  {
    id: "Puck",
    name: "Puck",
    gender: "neutral",
    personality: "Lively & Engaging",
    description: "Modern, upbeat, and articulate narration with natural inflection",
  },
  {
    id: "Kore",
    name: "Kore",
    gender: "female",
    personality: "Warm & Empathetic",
    description: "Friendly, balanced, and reassuring conversational delivery",
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "male",
    personality: "Deep & Resonant",
    description: "Authoritative, calm, and grounded studio narration",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "male",
    personality: "Crisp & Focused",
    description: "Sharp, analytical, and professional cadence",
  },
  {
    id: "Aoede",
    name: "Aoede",
    gender: "female",
    personality: "Melodic & Expressive",
    description: "Fluid, melodic, and engaging tone for long-form answers",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "neutral",
    personality: "Gentle & Smooth",
    description: "Relaxed, soothing, and effortless listening pace",
  },
];

let inMemorySettings: SpeechSettings | null = null;

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  engine: "device", // Default to device for instant 0ms, 100% free, offline availability
  geminiVoice: "Puck",
  deviceVoiceURI: "",
  playbackRate: 1.0,
  autoReadResponses: false,
  handsFreeMode: false,
  silenceTimeoutMs: 1500,
  sentenceStreaming: true,
  voiceButtonPlacement: "footer",
};



/**
 * Fetches the TTS audio URL for the given text and voice name.
 */
export async function fetchTTSAudioUrl(text: string, voiceName: string): Promise<{ audioUrl: string }> {
  const authHeaders = getAuthHeaders();
  return apiFetch<{ audioUrl: string }>("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      text,
      voiceName,
    }),
  });
}

export function loadSpeechSettings(): SpeechSettings {
  const fallback = inMemorySettings || DEFAULT_SPEECH_SETTINGS;
  const parsed = safeGetStorage<Partial<SpeechSettings>>(STORAGE_KEYS.SPEECH_SETTINGS, fallback);

  if (parsed === fallback) return fallback as SpeechSettings;

  return {
    engine: parsed.engine === "gemini" ? "gemini" : "device",
    geminiVoice: parsed.geminiVoice || "Puck",
    deviceVoiceURI: parsed.deviceVoiceURI || "",
    playbackRate: typeof parsed.playbackRate === "number" ? parsed.playbackRate : 1.0,
    autoReadResponses: Boolean(parsed.autoReadResponses),
    handsFreeMode: Boolean(parsed.handsFreeMode),
    silenceTimeoutMs: typeof parsed.silenceTimeoutMs === "number" ? parsed.silenceTimeoutMs : 1500,
    sentenceStreaming: parsed.sentenceStreaming !== false,
    voiceButtonPlacement: parsed.voiceButtonPlacement === "fab" ? "fab" : "footer",
  };
}

export function saveSpeechSettings(settings: SpeechSettings): void {
  inMemorySettings = settings;
  safeSetStorage(STORAGE_KEYS.SPEECH_SETTINGS, settings);
}

/**
 * Retrieves and filters system voices, scoring natural/neural voices to top
 */
export function getAvailableDeviceVoices(): DeviceVoiceOption[] {
  const synth = getSafeWindowSpeechSynthesis();
  if (!synth) {
    return [];
  }

  const rawVoices = synth.getVoices();
  if (!rawVoices || rawVoices.length === 0) return [];

  const options: DeviceVoiceOption[] = rawVoices.map((v) => {
    const lowerName = v.name.toLowerCase();
    const isNatural =
      lowerName.includes("natural") ||
      lowerName.includes("online") ||
      lowerName.includes("enhanced") ||
      lowerName.includes("google") ||
      lowerName.includes("siri") ||
      lowerName.includes("premium") ||
      lowerName.includes("neural");

    return {
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      isNatural,
      isDefault: v.default,
    };
  });

  // Sort natural voices first, then English / user language, then alphabetical
  const userLangPrefix = getSafeNavigatorLanguage("en").slice(0, 2).toLowerCase();

  return options.sort((a, b) => {
    if (a.isNatural !== b.isNatural) {
      return a.isNatural ? -1 : 1;
    }
    const aIsUserLang = a.lang.toLowerCase().startsWith(userLangPrefix);
    const bIsUserLang = b.lang.toLowerCase().startsWith(userLangPrefix);
    if (aIsUserLang !== bIsUserLang) {
      return aIsUserLang ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Automatically finds the highest-quality natural device voice matching the preferred URI or system
 */
export function getBestNaturalDeviceVoice(preferredURI?: string): SpeechSynthesisVoice | null {
  const synth = getSafeWindowSpeechSynthesis();
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices || voices.length === 0) return null;

  if (preferredURI) {
    const matched = voices.find((v) => v.voiceURI === preferredURI);
    if (matched) return matched;
  }

  const userLang = getSafeNavigatorLanguage("en").toLowerCase();
  const userLangPrefix = userLang.slice(0, 2);

  // 1. Natural / Neural voice in user's exact language
  const naturalExactLang = voices.find((v) => {
    const name = v.name.toLowerCase();
    const isNat =
      name.includes("natural") ||
      name.includes("online") ||
      name.includes("enhanced") ||
      name.includes("google") ||
      name.includes("siri") ||
      name.includes("premium") ||
      name.includes("neural");
    return isNat && v.lang.toLowerCase() === userLang;
  });
  if (naturalExactLang) return naturalExactLang;

  // 2. Natural / Neural voice in user's language family
  const naturalPrefixLang = voices.find((v) => {
    const name = v.name.toLowerCase();
    const isNat =
      name.includes("natural") ||
      name.includes("online") ||
      name.includes("enhanced") ||
      name.includes("google") ||
      name.includes("siri") ||
      name.includes("premium") ||
      name.includes("neural");
    return isNat && v.lang.toLowerCase().startsWith(userLangPrefix);
  });
  if (naturalPrefixLang) return naturalPrefixLang;

  // 3. Any voice in user's language
  const anyUserLang = voices.find((v) => v.lang.toLowerCase().startsWith(userLangPrefix));
  if (anyUserLang) return anyUserLang;

  // 4. Default voice
  const defaultVoice = voices.find((v) => v.default);
  return defaultVoice || voices[0] || null;
}
