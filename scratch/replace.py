import sys

with open('src/services/promptTemplateService.ts', 'r') as f:
    lines = f.readlines()

with open('scratch/prompt-class.ts', 'r') as f:
    class_lines = f.readlines()

for i, line in enumerate(lines):
    if line.startswith('export function getBuiltinTemplates()'):
        lines = lines[:i] + class_lines
        break

with open('src/services/promptTemplateService.ts', 'w') as f:
    f.writelines(lines)
