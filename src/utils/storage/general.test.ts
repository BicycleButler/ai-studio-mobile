import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneralSettingsService } from './general';
import { IMutableSingleton } from './types';

describe('GeneralSettingsService', () => {
  let mockApiKeySingleton: IMutableSingleton<string>;
  let mockFlagSecureSingleton: IMutableSingleton<boolean>;

  beforeEach(() => {
    mockApiKeySingleton = {
      load: vi.fn().mockReturnValue(''),
      save: vi.fn(),
      clear: vi.fn(),
      getFallback: vi.fn(),
      setFallback: vi.fn(),
    } as unknown as IMutableSingleton<string>;

    mockFlagSecureSingleton = {
      load: vi.fn().mockReturnValue(true),
      save: vi.fn(),
      clear: vi.fn(),
      getFallback: vi.fn(),
      setFallback: vi.fn(),
    } as unknown as IMutableSingleton<boolean>;
  });

  it('loads API key', () => {
    (mockApiKeySingleton.load as import("vitest").Mock).mockReturnValue('my-secret-key');
    const service = new GeneralSettingsService({
      apiKeySingleton: mockApiKeySingleton,
      flagSecureSingleton: mockFlagSecureSingleton,
    });
    expect(service.loadStoredApiKey()).toBe('my-secret-key');
  });

  it('saves API key and trims it', () => {
    const service = new GeneralSettingsService({
      apiKeySingleton: mockApiKeySingleton,
      flagSecureSingleton: mockFlagSecureSingleton,
    });
    service.saveStoredApiKey('  new-key  ');
    expect(mockApiKeySingleton.save).toHaveBeenCalledWith('  new-key  ');
  });

  it('clears API key when empty or whitespace is provided', () => {
    const service = new GeneralSettingsService({
      apiKeySingleton: mockApiKeySingleton,
      flagSecureSingleton: mockFlagSecureSingleton,
    });
    service.saveStoredApiKey('   ');
    expect(mockApiKeySingleton.clear).toHaveBeenCalled();
    expect(mockApiKeySingleton.save).not.toHaveBeenCalled();
  });

  it('loads flag secure enabled', () => {
    (mockFlagSecureSingleton.load as import("vitest").Mock).mockReturnValue(false);
    const service = new GeneralSettingsService({
      apiKeySingleton: mockApiKeySingleton,
      flagSecureSingleton: mockFlagSecureSingleton,
    });
    expect(service.isFlagSecureEnabled()).toBe(false);
  });

  it('sets flag secure enabled and notifies observable', () => {
    const service = new GeneralSettingsService({
      apiKeySingleton: mockApiKeySingleton,
      flagSecureSingleton: mockFlagSecureSingleton,
    });

    const notifySpy = vi.spyOn(service.flagSecureObservable, 'notify');

    service.setFlagSecureEnabled(false);
    expect(mockFlagSecureSingleton.save).toHaveBeenCalledWith(false);
    expect(notifySpy).toHaveBeenCalledWith(false);
  });
});
