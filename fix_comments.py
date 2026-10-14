import re

with open("src/utils/storage.ts", "r") as f:
    content = f.read()

# Fix static project name
content = content.replace("name: projectData.name.trim() || `AI Studio Project`,", "name: projectData.name.trim() || `AI Studio Project ${projectsCollection.load().length + 1}`,")

# Remove dead code
content = re.sub(r"let _cachedJulesSessions: JulesSession\[\] = \[\];\n", "", content)

# Remove unused this.memoryCache
content = re.sub(r"  private memoryCache: T\[\] \| null = null;\n", "", content)
content = re.sub(r"    this\.memoryCache = result;\n", "", content)
content = re.sub(r"    this\.memoryCache = items;\n", "", content)

with open("src/utils/storage.ts", "w") as f:
    f.write(content)

with open("src/services/chatHistoryService.ts", "r") as f:
    content = f.read()

# Fix explicit guard
guard = """export function saveChatSession(session: ChatSession, projectId?: string): void {
  if (!session.id || !session.messages || isMockChatSession(session)) return;"""

content = content.replace("export function saveChatSession(session: ChatSession, projectId?: string): void {\n  if (!session.id || !session.messages) return;", guard)

with open("src/services/chatHistoryService.ts", "w") as f:
    f.write(content)
