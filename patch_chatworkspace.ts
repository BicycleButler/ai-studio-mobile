import * as fs from 'fs';

let content = fs.readFileSync('src/components/ChatWorkspace.tsx', 'utf-8');

content = content.replace(
  'loadStoredJulesSessions,',
  'julesSessionsManager,'
);

content = content.replace(/loadStoredJulesSessions\(\)/g, 'julesSessionsManager.getItems()');

fs.writeFileSync('src/components/ChatWorkspace.tsx', content);
