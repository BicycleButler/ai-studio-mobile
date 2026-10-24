const fs = require('fs');

let authContent = fs.readFileSync('src/services/auth.ts', 'utf8');
authContent = authContent.replace(
    /this\.getStoredApiKeyFn = config\?\.loadStoredApiKeyFn \|\| \(\(\) => ""\);/,
    "this.getStoredApiKeyFn = config?.loadStoredApiKeyFn || (() => { const { defaultGeneralSettingsService } = require('../utils/storage'); return defaultGeneralSettingsService.loadStoredApiKey(); });"
);
fs.writeFileSync('src/services/auth.ts', authContent);

let importProjectSheetContent = fs.readFileSync('src/components/ImportProjectSheet.tsx', 'utf8');
if (!importProjectSheetContent.includes("import { defaultProjectService } from")) {
    importProjectSheetContent = importProjectSheetContent.replace(
        /import \{ useAppState \} from "\.\.\/hooks\/useAppState";\n/,
        "import { useAppState } from \"../hooks/useAppState\";\nimport { defaultProjectService } from \"../utils/storage\";\n"
    );
    fs.writeFileSync('src/components/ImportProjectSheet.tsx', importProjectSheetContent);
}

let unifiedSettingsModalContent = fs.readFileSync('src/components/UnifiedSettingsModal.tsx', 'utf8');
if (!unifiedSettingsModalContent.includes("import { defaultGeneralSettingsService } from")) {
    unifiedSettingsModalContent = unifiedSettingsModalContent.replace(
        /import \{ getSafeWindowSpeechSynthesis \} from "\.\.\/utils\/platform";\n/,
        "import { getSafeWindowSpeechSynthesis } from \"../utils/platform\";\nimport { defaultGeneralSettingsService } from \"../utils/storage\";\n"
    );
    fs.writeFileSync('src/components/UnifiedSettingsModal.tsx', unifiedSettingsModalContent);
}

let appAuthContent = fs.readFileSync('src/hooks/useAppAuth.ts', 'utf8');
appAuthContent = appAuthContent.replace(/import \{ useServices \} from "\.\.\/services\/ServiceContext";\nimport \{ useServices \} from "\.\.\/services\/ServiceContext";\n/, "import { useServices } from \"../services/ServiceContext\";\n");
fs.writeFileSync('src/hooks/useAppAuth.ts', appAuthContent);
