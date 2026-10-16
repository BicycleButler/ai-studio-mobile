import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf-8');

content = content.replace('filteredList?: any[]', 'filteredList?: ProjectInfo[]');

fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content);
