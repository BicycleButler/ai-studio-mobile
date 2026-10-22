const fs = require('fs');
let content = fs.readFileSync('src/hooks/useJules.ts', 'utf8');

content = content.replace(
  'await approveJulesPlan(taskId, false, julesApiKey);',
  'await julesClient.approvePlan(taskId, false, julesApiKey);'
);

fs.writeFileSync('src/hooks/useJules.ts', content);
