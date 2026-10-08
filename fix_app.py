import re
with open("src/App.tsx", "r") as f:
    content = f.read()

content = content.replace("const data = await apiFetch<{ hasServerApiKey?: boolean }>(\"/api/health\");\n      const hasKey = Boolean(data.hasServerApiKey);\n      setHasServerKey(hasKey);\n      return hasKey;", "const data = await apiFetch<{ hasServerApiKey?: boolean }>(\"/api/health\");\n      const hasKey = Boolean(data.hasServerApiKey);\n      setHasServerKey(hasKey);\n      return hasKey;")

with open("src/App.tsx", "w") as f:
    f.write(content)
