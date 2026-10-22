const fs = require('fs');

let content = fs.readFileSync('src/services/julesService.ts', 'utf8');

content = content.replace(
  'const defaultJulesClient = new JulesClient({',
  'export const defaultJulesClient = new JulesClient({'
);

fs.writeFileSync('src/services/julesService.ts', content);
