import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/App.tsx', 'utf-8');
content = content.replace(
    'import { getSafeDocument, getSafeWindow } from "./utils/platform";\n',
    ''
);
writeFileSync('src/App.tsx', content);
