import re

with open('src/components/JulesSessionDrawer.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useServices } from \"../services/ServiceContext\";\nimport { useServices } from \"../services/ServiceContext\";", "import { useServices } from \"../services/ServiceContext\";")

with open('src/components/JulesSessionDrawer.tsx', 'w') as f:
    f.write(content)
