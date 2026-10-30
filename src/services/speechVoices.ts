import { IApiClient, defaultClient } from "../utils/apiClient";
import { IAuthService, defaultAuthService } from "./auth";
import { getSafeNavigatorLanguage } from "../utils/platform";
/**
 * Voice definitions and speech playback engine
 * Supports:
 * 1. Gemini AI Studio HD Voices (gemini-3.1-flash-tts-preview)
 * 2. Enhanced On-Device System Voices (with intelligent Natural/Neural voice prioritization)
 */

import { STORAGE_KEYS, defaultStorageFactory } from "../utils/storage";
import { IMutableSingleton } from "../utils/storage/types";

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

export interface ISpeechVoicesService {
  fetchTTSAudioUrl(text: string, voiceName: string): Promise<{ audioUrl: string }>;
  loadSpeechSettings(): SpeechSettings;
  saveSpeechSettings(settings: SpeechSettings): void;
  getAvailableDeviceVoices(): DeviceVoiceOption[];
  getBestNaturalDeviceVoice(preferredURI?: string): SpeechSynthesisVoice | null;
}

export interface SpeechVoicesServiceConfig {
  authService: IAuthService;
  apiClient: IApiClient;
  speechSettingsSingleton?: IMutableSingleton<SpeechSettings>;

  getNavigatorLanguage?: typeof getSafeNavigatorLanguage;
}

import { IPlatformService, defaultPlatformService } from "./platformService";
export class SpeechVoicesService implements ISpeechVoicesService {
  private platformService: IPlatformService;
  private speechSettingsSingleton: IMutableSingleton<SpeechSettings>;

  private getNavigatorLanguage: typeof getSafeNavigatorLanguage;
  private authService: IAuthService;
  private apiClient: IApiClient;

  constructor(config: SpeechVoicesServiceConfig, platformService?: IPlatformService) {
    this.platformService = platformService || defaultPlatformService;

    this.getNavigatorLanguage = config?.getNavigatorLanguage || getSafeNavigatorLanguage;
    this.authService = config.authService;
    this.apiClient = config.apiClient;
    this.speechSettingsSingleton = config?.speechSettingsSingleton || defaultStorageFactory.createSingleton<SpeechSettings>(
      STORAGE_KEYS.SPEECH_SETTINGS,
      DEFAULT_SPEECH_SETTINGS,
      {
        transformOut: (parsed) => {
          if (!parsed) return DEFAULT_SPEECH_SETTINGS;
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
      }
    );
  }

  /**
   * Fetches the TTS audio URL for the given text and voice name.
   */
  public async fetchTTSAudioUrl(text: string, voiceName: string): Promise<{ audioUrl: string }> {
    const authHeaders = this.authService.getAuthHeaders();
    return this.apiClient.fetch<{ audioUrl: string }>("/api/tts", {
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

  public loadSpeechSettings(): SpeechSettings {
    return this.speechSettingsSingleton.load();
  }

  public saveSpeechSettings(settings: SpeechSettings): void {
    this.speechSettingsSingleton.save(settings);
  }

  private isNaturalVoiceName(name: string): boolean {
    const lowerName = name.toLowerCase();
    return (
      lowerName.includes("natural") ||
      lowerName.includes("online") ||
      lowerName.includes("enhanced") ||
      lowerName.includes("google") ||
      lowerName.includes("siri") ||
      lowerName.includes("premium") ||
      lowerName.includes("neural")
    );
  }

  /**
   * Retrieves and filters system voices, scoring natural/neural voices to top
   */
  public getAvailableDeviceVoices(): DeviceVoiceOption[] {
    const synth = this.platformService.getSpeechSynthesis();
    if (!synth) {
      return [];
    }

    const rawVoices = synth.getVoices();
    if (!rawVoices || rawVoices.length === 0) return [];

    const options: DeviceVoiceOption[] = rawVoices.map((v) => {
      return {
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        isNatural: this.isNaturalVoiceName(v.name),
        isDefault: v.default,
      };
    });

    const userLangPrefix = this.getNavigatorLanguage("en").slice(0, 2).toLowerCase();

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
  public getBestNaturalDeviceVoice(preferredURI?: string): SpeechSynthesisVoice | null {
    const synth = this.platformService.getSpeechSynthesis();
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices || voices.length === 0) return null;

    if (preferredURI) {
      const matched = voices.find((v) => v.voiceURI === preferredURI);
      if (matched) return matched;
    }

    const userLang = this.getNavigatorLanguage("en").toLowerCase();
    const userLangPrefix = userLang.slice(0, 2);

    const naturalExactLang = voices.find((v) => this.isNaturalVoiceName(v.name) && v.lang.toLowerCase() === userLang);
    if (naturalExactLang) return naturalExactLang;

    const naturalPrefixLang = voices.find((v) => this.isNaturalVoiceName(v.name) && v.lang.toLowerCase().startsWith(userLangPrefix));
    if (naturalPrefixLang) return naturalPrefixLang;

    const anyUserLang = voices.find((v) => v.lang.toLowerCase().startsWith(userLangPrefix));
    if (anyUserLang) return anyUserLang;

    const defaultVoice = voices.find((v) => v.default);
    return defaultVoice || voices[0] || null;
  }
}

export const defaultSpeechVoicesService = new SpeechVoicesService({ apiClient: defaultClient, authService: defaultAuthService });
