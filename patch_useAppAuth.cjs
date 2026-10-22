const fs = require('fs');

let content = fs.readFileSync('src/hooks/useAppAuth.ts', 'utf8');

// Replace imports
content = content.replace(
  /import {\s*getStoredGoogleUser,\s*fetchServerCurrentUser,\s*initiateGoogleLogin,\s*logoutGoogleUser,\s*initAuth,?\s*} from "\.\.\/services\/googleAuth";/g,
  'import { useServices } from "../services/ServiceContext";'
);
content = content.replace(
  /import { loadStoredApiKey, saveStoredApiKey } from "\.\.\/utils\/storage";/g,
  ''
);

// Insert hook usage
content = content.replace(
  'export function useAppAuth() {',
  'export function useAppAuth() {\n  const { googleAuthService, generalSettingsService } = useServices();'
);

// Replace function calls
content = content.replace(
  'getStoredGoogleUser()',
  'googleAuthService.loadStoredGoogleUser()'
);
content = content.replace(
  'loadStoredApiKey()',
  'generalSettingsService.loadStoredApiKey()'
);
content = content.replace(
  'saveStoredApiKey(key);',
  'generalSettingsService.saveStoredApiKey(key);'
);
content = content.replace(
  'initiateGoogleLogin()',
  'googleAuthService.initiateGoogleLogin()'
);
content = content.replace(
  'logoutGoogleUser()',
  'googleAuthService.logoutGoogleUser()'
);
content = content.replace(
  'fetchServerCurrentUser()',
  'googleAuthService.fetchCurrentGoogleUser()'
);
content = content.replace(
  'initAuth()',
  'googleAuthService.initAuth()'
);

fs.writeFileSync('src/hooks/useAppAuth.ts', content);
