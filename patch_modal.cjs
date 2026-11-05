const fs = require('fs');

const file = 'src/components/UnifiedSettingsModal.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('SETTINGS_TABS_CONFIG')) {
  content = content.replace(
    'import { SettingsSidebar } from "./settings/SettingsSidebar";',
    'import { SettingsSidebar } from "./settings/SettingsSidebar";\nimport { SETTINGS_TABS_CONFIG } from "./settings/SettingsTabsConfig";'
  );
}

const activeTabConfigStr = `  const activeTabConfig = SETTINGS_TABS_CONFIG.find(t => t.id === activeTab) || SETTINGS_TABS_CONFIG[0];\n  const ActiveTabIcon = activeTabConfig.icon;\n\n  const activeTabTitle = activeTab === "account" ? "Profile & Account" : activeTab === "display" ? "Themes & Appearance" : activeTab === "security" ? "Settings & Security" : activeTab === "model" ? "Models & Tuners" : activeTab === "audio" ? "Voice & Audio" : activeTab === "library" ? "Prompt Library" : activeTab === "export" ? "Get Code" : "Companion & Guide";`;

content = content.replace(
  '  const isJulesConfigured = Boolean(julesApiKey.trim());\n\n  return (',
  '  const isJulesConfigured = Boolean(julesApiKey.trim());\n\n' + activeTabConfigStr + '\n\n  return ('
);

content = content.replace(
  /<div className="w-8 h-8 rounded-lg bg-primary\/10 text-primary flex items-center justify-center shrink-0">[\s\S]*?<\/div>/,
  '<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">\n                <ActiveTabIcon className="w-4 h-4" />\n              </div>'
);

content = content.replace(
  /<h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">[\s\S]*?<\/h2>/,
  '<h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight truncate">\n                  {activeTabTitle}\n                </h2>'
);

fs.writeFileSync(file, content);
