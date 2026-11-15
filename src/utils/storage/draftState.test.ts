import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftStateService, DraftState } from './draftState';
import { IStorageRegistry } from './StorageRegistry';
import { IMutableSingleton } from './types';
import { DEFAULT_CONFIG } from '../../data/templates';
import { STORAGE_KEYS } from './constants';
import { ILogger } from '../logger';

describe('DraftStateService', () => {
  let mockDraftRegistry: Required<IStorageRegistry<IMutableSingleton<DraftState | null>>>;
  let mockDraftSingleton: IMutableSingleton<DraftState | null>;
  let mockGlobalDraftSingleton: IMutableSingleton<DraftState | null>;
  let mockLogger: Required<ILogger>;

  beforeEach(() => {
    mockDraftSingleton = {
      load: vi.fn(),
      save: vi.fn(),
      clear: vi.fn(),
      getFallback: vi.fn(),
      setFallback: vi.fn(),
    } as unknown as IMutableSingleton<DraftState | null>;

    mockGlobalDraftSingleton = {
      load: vi.fn(),
      save: vi.fn(),
      clear: vi.fn(),
      getFallback: vi.fn(),
      setFallback: vi.fn(),
    } as unknown as IMutableSingleton<DraftState | null>;

    mockDraftRegistry = {
      ...({} as unknown as IMutableSingleton<DraftState | null>),
      get: vi.fn((key: string) => {
        if (key === STORAGE_KEYS.DRAFT_STATE) {
            return mockGlobalDraftSingleton;
        }
        return mockDraftSingleton;
      }),
      delete: vi.fn(),
      clear: vi.fn(),
      keys: [],
      values: [],
    };

    mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
  });

  it('initializes and generates correct keys', () => {
    const service = new DraftStateService({ logger: mockLogger, draftRegistry: mockDraftRegistry });
    expect(service.getProjectDraftKey()).toBe(STORAGE_KEYS.DRAFT_STATE);
    expect(service.getProjectDraftKey('proj1')).toBe(`${STORAGE_KEYS.DRAFT_STATE}_proj1`);
  });

  it('loads default fallback state when nothing is stored', () => {
    (mockDraftSingleton.load as import("vitest").Mock).mockReturnValue(null);
    const service = new DraftStateService({ logger: mockLogger, draftRegistry: mockDraftRegistry });
    const draft = service.loadDraftState('proj1');
    expect(draft.promptType).toBe('chat');
    expect(draft.config).toEqual(DEFAULT_CONFIG);
  });

  it('falls back to global draft if project draft is null but global exists', () => {
    (mockDraftSingleton.load as import("vitest").Mock).mockReturnValue(null);
    const globalState = {
        promptType: 'code' as const,
        config: { ...DEFAULT_CONFIG, temperature: 0.8 },
        chatInputText: 'hello',
        freeformText: '',
        structuredExamples: [],
        updatedAt: 123,
    };
    (mockGlobalDraftSingleton.load as import("vitest").Mock).mockReturnValue(globalState);

    const service = new DraftStateService({ logger: mockLogger, draftRegistry: mockDraftRegistry });
    const draft = service.loadDraftState('proj1');

    expect(draft.promptType).toBe('code');
    expect(draft.config.temperature).toBe(0.8);
  });

  it('saves draft state', () => {
    const existingState = {
        promptType: 'chat' as const,
        config: DEFAULT_CONFIG,
        chatInputText: 'existing',
        freeformText: '',
        structuredExamples: [],
        updatedAt: 123,
    };
    (mockDraftSingleton.load as import("vitest").Mock).mockReturnValue(existingState);

    const service = new DraftStateService({ logger: mockLogger, draftRegistry: mockDraftRegistry });
    service.saveDraftState({ chatInputText: 'new text' }, 'proj1');

    expect(mockDraftSingleton.save).toHaveBeenCalled();
    const savedArg = (mockDraftSingleton.save as import("vitest").Mock).mock.calls[0][0];
    expect(savedArg?.chatInputText).toBe('new text');
    expect(savedArg?.promptType).toBe('chat');
    expect(savedArg?.updatedAt).toBeGreaterThan(123);
  });

  it('strips heavy base64 image data and data URLs when saving draft messages', () => {
    (mockDraftSingleton.load as import("vitest").Mock).mockReturnValue(null);
    (mockGlobalDraftSingleton.load as import("vitest").Mock).mockReturnValue(null);

    const service = new DraftStateService({ logger: mockLogger, draftRegistry: mockDraftRegistry });
    service.saveDraftState(
      {
        messages: [
          {
            id: 'm1',
            role: 'user',
            text: 'Look at this image',
            timestamp: 1000,
            images: [
              {
                id: 'img1',
                name: 'photo.png',
                mimeType: 'image/png',
                sizeKb: 120,
                data: 'VERY_LARGE_BASE64_PAYLOAD',
                previewUrl: 'data:image/png;base64,VERY_LARGE_BASE64_PAYLOAD',
              },
            ],
          },
        ],
      },
      'proj1'
    );

    const savedArg = (mockDraftSingleton.save as import("vitest").Mock).mock.calls[0][0];
    expect(savedArg?.messages?.[0]?.images?.[0]?.data).toBe('');
    expect(savedArg?.messages?.[0]?.images?.[0]?.previewUrl).toBe('');
  });
});
