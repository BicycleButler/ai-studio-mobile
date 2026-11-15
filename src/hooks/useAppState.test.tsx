import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { useAppState } from "./useAppState";
import { ServiceProvider } from "../services/ServiceContext";
import { DraftState, IDraftStateService } from "../utils/storage/draftState";

describe("useAppState persistence reliability", () => {
  const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");

  afterEach(() => {
    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor);
    }
  });

  it("flushes pending debounced draft state immediately when document becomes hidden", () => {
    const initialDraft: DraftState = {
      promptType: "chat",
      config: {
        model: "gemini-2.5-flash",
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
        systemInstruction: "",
        responseMimeType: "text/plain",
        responseSchemaText: "",
      },
      chatInputText: "",
      freeformText: "",
      structuredExamples: [],
      selectedTemplateIds: [],
      messages: [],
      updatedAt: 1_700_000_000_000,
    };

    const saveDraftState = vi.fn();
    const mockDraftService: IDraftStateService = {
      getProjectDraftKey: vi.fn((projectId?: string | null) =>
        projectId ? `ai_studio_draft_${projectId}` : "ai_studio_draft"
      ),
      loadDraftState: vi.fn(() => initialDraft),
      saveDraftState,
    };

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ServiceProvider services={{ draftStateService: mockDraftService }}>
        {children}
      </ServiceProvider>
    );

    const { result, unmount } = renderHook(() => useAppState(), { wrapper });

    act(() => {
      result.current.setPromptType("code");
    });

    // Debounce timer (500ms) has not fired yet
    expect(saveDraftState).not.toHaveBeenCalled();

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(saveDraftState).toHaveBeenCalledTimes(1);
    expect(saveDraftState).toHaveBeenCalledWith(
      expect.objectContaining({ promptType: "code" }),
      undefined
    );

    unmount();
  });
});
