import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/main.tsx', 'utf-8');
content = content.replace(
    'import { getSafeDocument, getSafeNavigator } from "./utils/platform";\nimport { isBrowserEnvironment } from "./utils/platform";',
    'import { getSafeDocument, getSafeNavigator, isBrowserEnvironment } from "./utils/platform";'
);
writeFileSync('src/main.tsx', content);
