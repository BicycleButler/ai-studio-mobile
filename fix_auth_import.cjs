const fs = require('fs');

let content = fs.readFileSync('src/services/auth.ts', 'utf8');
content = content.replace(
    /import \{ apiFetch \} from "\.\.\/utils\/apiClient";\n/,
    "import { apiFetch } from \"../utils/apiClient\";\nimport { defaultGeneralSettingsService } from \"../utils/storage\";\n"
);
content = content.replace(
    /this\.getStoredApiKeyFn = config\?\.loadStoredApiKeyFn \|\| \(\(\) => \{ const \{ defaultGeneralSettingsService \} = require\('\.\.\/utils\/storage'\); return defaultGeneralSettingsService\.loadStoredApiKey\(\); \}\);/,
    "this.getStoredApiKeyFn = config?.loadStoredApiKeyFn || (() => defaultGeneralSettingsService.loadStoredApiKey());"
);
fs.writeFileSync('src/services/auth.ts', content);
