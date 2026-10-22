const fs = require('fs');

let content = fs.readFileSync('src/hooks/useJules.ts', 'utf8');

// Replace imports
content = content.replace(
  /import {\s*loadStoredJulesApiKey,\s*saveStoredJulesApiKey,\s*fetchJulesSessionsFromServer,?\s*} from "\.\.\/utils\/storage";/g,
  'import { useServices } from "../services/ServiceContext";'
);

content = content.replace(
  /import {\s*julesSessionsManager\s*} from "\.\.\/utils\/storage";/g,
  ''
);

content = content.replace(
  /import {\s*dispatchJulesTask,\s*subscribeToJulesTask,\s*approveJulesPlan,\s*bulkDeleteJulesSessions\s*} from "\.\.\/services\/julesService";/g,
  'import { bulkDeleteJulesSessions } from "../services/julesService";'
);

// Insert hook usage
content = content.replace(
  'export function useJules() {',
  'export function useJules() {\n  const { julesStorageService, julesClient } = useServices();\n  const julesSessionsManager = julesStorageService.julesSessionsManager;'
);

// Replace function calls
content = content.replace(
  'loadStoredJulesApiKey()',
  'julesStorageService.loadStoredJulesApiKey()'
);
content = content.replace(
  'saveStoredJulesApiKey(key)',
  'julesStorageService.saveStoredJulesApiKey(key)'
);
content = content.replace(
  'fetchJulesSessionsFromServer()',
  'julesStorageService.fetchJulesSessionsFromServer()'
);
content = content.replace(
  'dispatchJulesTask(julesApiKey, {',
  'julesClient.dispatchTask(julesApiKey, {'
);
content = content.replace(
  'subscribeToJulesTask(',
  'julesClient.subscribeToTask('
);
content = content.replace(
  'approveJulesPlan(',
  'julesClient.approvePlan('
);

fs.writeFileSync('src/hooks/useJules.ts', content);
