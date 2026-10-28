import re

with open('src/components/settings/SettingsAudioTab.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'  deviceVoices: DeviceVoiceOption\[\];\n',
    '',
    content
)
content = re.sub(
    r'  deviceVoices,\n\}\) => \{',
    '}) => {\n  const [deviceVoices] = React.useState<DeviceVoiceOption[]>([]);',
    content
)

with open('src/components/settings/SettingsAudioTab.tsx', 'w') as f:
    f.write(content)
