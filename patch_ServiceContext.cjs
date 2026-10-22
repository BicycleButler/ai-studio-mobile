const fs = require('fs');

let content = fs.readFileSync('src/services/ServiceContext.tsx', 'utf8');

// Add import
content = content.replace(
  'import { defaultJulesStorageService, JulesStorageService } from "../utils/storage/jules";',
  'import { defaultJulesStorageService, JulesStorageService } from "../utils/storage/jules";\nimport { defaultJulesClient, JulesClient } from "./julesService";'
);

// Add to IServices
content = content.replace(
  '  codeGeneratorService: ICodeGeneratorService;',
  '  codeGeneratorService: ICodeGeneratorService;\n  julesClient: JulesClient;'
);

// Add to defaultServices
content = content.replace(
  '  codeGeneratorService: defaultCodeGeneratorService,',
  '  codeGeneratorService: defaultCodeGeneratorService,\n  julesClient: defaultJulesClient,'
);

fs.writeFileSync('src/services/ServiceContext.tsx', content);
