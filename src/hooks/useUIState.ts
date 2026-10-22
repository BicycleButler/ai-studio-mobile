import { useState, useEffect } from "react";
import { DeviceFrameMode, SettingsTab } from "../types";
import { SpeechSettings, defaultSpeechVoicesService } from "../services/speechVoices";
import { getSafeWindow } from "../utils/platform";

export function useUIState() {
  const [deviceMode, setDeviceMode] = useState<DeviceFrameMode>("responsive");
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [showTunerSheet, setShowTunerSheet] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(() => defaultSpeechVoicesService.loadSpeechSettings());

  const [showCustomTabBrowser, setShowCustomTabBrowser] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [candidateClipboardKey, setCandidateClipboardKey] = useState<string>("");
  const [clipboardToastKey, setClipboardToastKey] = useState<string | null>(null);

  const [showJulesDrawer, setShowJulesDrawer] = useState(false);
  const [browserService, setBrowserService] = useState<"aistudio" | "jules">("aistudio");

  const handleOpenSettings = (tab: SettingsTab = "account") => {
    setSettingsTab(tab);
    setShowSettingsModal(true);
  };

  useEffect(() => {
    const win = getSafeWindow();
    if (win && win.innerWidth >= 1024) {
      setDeviceMode("pixel");
    }
  }, []);

  return {
    deviceMode,
    setDeviceMode,
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
    showJulesDrawer,
    setShowJulesDrawer,
    browserService,
    setBrowserService,
    handleOpenSettings,
  };
}
