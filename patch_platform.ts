import fs from 'fs';

let content = fs.readFileSync('src/services/ServiceContext.tsx', 'utf8');
content = `import { IPlatformService, BrowserPlatformService } from "./platformService";\n` + content;
fs.writeFileSync('src/services/ServiceContext.tsx', content);
