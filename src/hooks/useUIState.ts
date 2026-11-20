import { useState } from "react";
import { SettingsTab } from "../types";
import { SpeechSettings } from "../services/speechVoices";
import { useServices } from "../services/ServiceContext";

export function useUIState() {
  const { speechVoicesService } = useServices();
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [showTunerSheet, setShowTunerSheet] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(() => speechVoicesService.loadSpeechSettings());

  const [showCustomTabBrowser, setShowCustomTabBrowser] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [candidateClipboardKey, setCandidateClipboardKey] = useState<string>("");
  const [clipboardToastKey, setClipboardToastKey] = useState<string | null>(null);

  const handleOpenSettings = (tab: SettingsTab = "account") => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
  };

  return {
    showBottomNav,
    setShowBottomNav,
    showTunerSheet,
    setShowTunerSheet,
    showSettingsModal,
    setShowSettingsModal,
    settingsTab,
    setSettingsTab,
    speechSettings,
    setSpeechSettings,
    showCustomTabBrowser,
    setShowCustomTabBrowser,
    showImportModal,
    setShowImportModal,
    candidateClipboardKey,
    setCandidateClipboardKey,
    clipboardToastKey,
    setClipboardToastKey,
    handleOpenSettings,
  };
}
