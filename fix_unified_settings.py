import re

with open('src/components/UnifiedSettingsModal.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'              handleSelectRate=\{handleSelectRate\}\n              deviceVoices=\{\[\]\}\n            />',
    r'              handleSelectRate={handleSelectRate}\n            />',
    content
)

with open('src/components/UnifiedSettingsModal.tsx', 'w') as f:
    f.write(content)
