import { describe, test, expect } from 'vitest';
import {
  DEFAULT_SPEECH_SETTINGS,
  SpeechSettings,
  SpeechVoicesService,
} from "./speechVoices";


describe('testSpeechSettingsSuite', () => {
  test('main', () => {
    // We instantiate a local service for isolated testing without hitting globals if desired
    // For this exact parity test, we can just use the service to emulate what was happening globally.
    const service = new SpeechVoicesService();

    // Test 1: Defaults
    expect(DEFAULT_SPEECH_SETTINGS.voiceButtonPlacement).toBe("footer");

    // Test 2: In-memory fallback / load
    const loaded = service.loadSpeechSettings();
    expect(loaded.voiceButtonPlacement).toBeDefined();

    // Test 3: Save and reload with FAB placement
    const customSettings: SpeechSettings = {
      ...DEFAULT_SPEECH_SETTINGS,
      voiceButtonPlacement: "fab",
      silenceTimeoutMs: 2000,
    };
    service.saveSpeechSettings(customSettings);

    const reloaded = service.loadSpeechSettings();
    expect(reloaded.voiceButtonPlacement).toBe("fab");

    // Restore defaults
    service.saveSpeechSettings(DEFAULT_SPEECH_SETTINGS);
  });
});
