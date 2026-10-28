import { useState, useEffect } from "react";
import { DeviceFrameMode, SettingsTab } from "../types";
import { SpeechSettings } from "../services/speechVoices";
import { useServices } from "../services/ServiceContext";

export function useUIState() {
  const { speechVoicesService, platformService } = useServices();
  const [deviceMode, setDeviceMode] = useState<DeviceFrameMode>("responsive");
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [showTunerSheet, setShowTunerSheet] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [speechSettings, setSpeechSettings] = useState<SpeechSettings>(() => speechVoicesService.loadSpeechSettings());

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
    const win = platformService.getWindow();
    if (win && win.innerWidth >= 1024) {
      setDeviceMode("pixel");
    }
  }, [platformService]);

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
