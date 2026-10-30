const fs = require('fs');
let code = fs.readFileSync('src/utils/offlineService.ts', 'utf8');
code = code.replace(/\/\/ \n  \n\n/g, '');
fs.writeFileSync('src/utils/offlineService.ts', code);
