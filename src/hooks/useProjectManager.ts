import { useServices } from "../services/ServiceContext";
import { useStore } from "./useStore";
import { ProjectInfo, PromptConfig, PromptType } from "../types";


export function useProjectManager(
  chatSession: ReturnType<typeof import("./useChatSession").useChatSession>,
  setPromptType: (pt: PromptType) => void,
  setConfig: (updater: PromptConfig | ((prev: PromptConfig) => PromptConfig)) => void,
  setCustomApiKey: (key: string) => void,
  setCandidateClipboardKey: (key: string) => void,
  setClipboardToastKey: (key: string | null) => void,
  promptType: PromptType,
  config: PromptConfig
) {
  const { chatHistoryService, projectService, generalSettingsService, draftStateService, firestoreSyncService, logger, idGenerator } = useServices();
  const projectManagerStore = useStore(projectService.projectsManager);
  const projects = projectManagerStore.items;

  const setProjects: React.Dispatch<React.SetStateAction<ProjectInfo[]>> = (val) => {
    if (typeof val === "function") {
      projectService.projectsManager.collection.save(val(projects));
    } else {
      projectService.projectsManager.collection.save(val);
    }
  };

  const activeProject = projectManagerStore.activeItem;

  const setActiveProject: React.Dispatch<React.SetStateAction<ProjectInfo | null>> = (val) => {
    if (typeof val === "function") {
      const result = val(activeProject);
      projectService.projectsManager.setActiveId(result ? result.id : null);
    } else {
      projectService.projectsManager.setActiveId(val ? val.id : null);
    }
  };

  const handleProjectActivated = (project: ProjectInfo, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }

    // Persist current draft under outgoing active project
    draftStateService.saveDraftState(
      {
        promptType,
        config,
        freeformText: chatSession.freeformText,
        structuredExamples: chatSession.structuredExamples,
        messages: chatSession.messages,
      },
      activeProject?.id
    );

    // Mark new project active in storage & local state
    projectService.setActiveProjectId(project.id);
    setActiveProject(project);
    setCustomApiKey(project.apiKey);
    generalSettingsService.saveStoredApiKey(project.apiKey);

    // Load incoming project's scoped draft state
    const targetDraft = draftStateService.loadDraftState(project.id);
    setPromptType(targetDraft.promptType);
    setConfig({
      ...targetDraft.config,
      ...(project.defaultModel ? { model: project.defaultModel } : {}),
    });
    if (targetDraft.messages && targetDraft.messages.length > 0) {
      chatSession.setMessages(targetDraft.messages);
    } else {
      chatSession.setMessages([]);
    }

    setCandidateClipboardKey("");
    setClipboardToastKey(null);

    chatSession.setCurrentSessionId(idGenerator.generate("sess"));
    void firestoreSyncService?.syncWorkspaceProject(project)?.catch((err) => {
      logger.warn("Background project sync failed:", err);
    });
  };

  const handleRenameProject = (id: string, newName: string) => {
    projectService.projectsManager.collection.update(id, { name: newName });
    const updatedProj = projectService.projectsManager.getItems().find((p) => p.id === id);
    if (updatedProj) {
      void firestoreSyncService?.syncWorkspaceProject(updatedProj)?.catch((err) => {
        logger.warn("Background project rename sync failed:", err);
      });
    }
  };

  const handleDeleteProject = (id: string, onStopStream?: () => void) => {
    projectService.projectsManager.collection.delete(id);
    void firestoreSyncService?.deleteWorkspaceProject(id)?.catch((err) => {
      logger.warn("Background project delete sync failed:", err);
    });
    try {
      chatHistoryService.clearAllChatSessions.bind(chatHistoryService)(id);
    } catch(e) {
      logger.error("Failed to clean up chat sessions", e);
    }
    const updated = projectService.projectsManager.getItems();
    if (activeProject?.id === id) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0], onStopStream);
      } else {
        setCustomApiKey("");
        generalSettingsService.saveStoredApiKey("");
        chatSession.setMessages([]);
      }
    }
  };

  const handleBulkDeleteProjects = (ids: string[], onStopStream?: () => void) => {
    projectService.projectsManager.collection.bulkDelete(ids);
    ids.forEach((id) => {
      void firestoreSyncService?.deleteWorkspaceProject(id)?.catch((err) => {
        logger.warn("Background bulk project delete sync failed:", err);
      });
    });
    try {
      ids.forEach(id => chatHistoryService.clearAllChatSessions.bind(chatHistoryService)(id));
    } catch(e) {
      logger.error("Failed to clean up chat sessions", e);
    }
    const updated = projectService.projectsManager.getItems();

    if (activeProject && ids.includes(activeProject.id)) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0], onStopStream);
      } else {
        setCustomApiKey("");
        generalSettingsService.saveStoredApiKey("");
        chatSession.setMessages([]);
      }
    }
  };

  return {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    handleProjectActivated,
    handleRenameProject,
    handleDeleteProject,
    handleBulkDeleteProjects,
  };
}
