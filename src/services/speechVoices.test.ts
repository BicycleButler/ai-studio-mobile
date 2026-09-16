import {
  DEFAULT_SPEECH_SETTINGS,
  loadSpeechSettings,
  saveSpeechSettings,
  SpeechSettings,
} from "./speechVoices";

export function testSpeechSettingsSuite(): boolean {
  // Test 1: Defaults
  if (DEFAULT_SPEECH_SETTINGS.voiceButtonPlacement !== "footer") {
    throw new Error(
      `Expected default voiceButtonPlacement to be 'footer', got '${DEFAULT_SPEECH_SETTINGS.voiceButtonPlacement}'`
    );
  }

  // Test 2: In-memory fallback / load
  const loaded = loadSpeechSettings();
  if (typeof loaded.voiceButtonPlacement === "undefined") {
    throw new Error("Expected loaded speech settings to include voiceButtonPlacement");
  }

  // Test 3: Save and reload with FAB placement
  const customSettings: SpeechSettings = {
    ...DEFAULT_SPEECH_SETTINGS,
    voiceButtonPlacement: "fab",
    silenceTimeoutMs: 2000,
  };
  saveSpeechSettings(customSettings);
  const reloaded = loadSpeechSettings();
  if (reloaded.voiceButtonPlacement !== "fab") {
    throw new Error(
      `Expected voiceButtonPlacement to persist as 'fab', got '${reloaded.voiceButtonPlacement}'`
    );
  }

  // Restore defaults
  saveSpeechSettings(DEFAULT_SPEECH_SETTINGS);

  return true;
}
