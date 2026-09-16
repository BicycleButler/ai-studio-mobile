import { SavedPrompt } from "../types";

export const DEFAULT_CONFIG = {
  model: "gemini-3.8-flash",
  systemInstruction: "You are an intelligent, precise AI assistant inside Google AI Studio. Provide concise, clear, and actionable responses with clean code blocks when relevant.",
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
  responseMimeType: "text/plain" as const,
  responseSchemaText: "",
};

export const STARTER_TEMPLATES: SavedPrompt[] = [
  {
    id: "template-chat-code",
    title: "Full-Stack Code Assistant",
    type: "chat",
    config: {
      ...DEFAULT_CONFIG,
      temperature: 0.2,
      systemInstruction: "You are an expert Google staff software engineer. Write clean, idiomatic, fully-typed TypeScript and modern Android Kotlin. Always prioritize correctness, security, and edge-case handling.",
    },
    messages: [
      {
        id: "m-1",
        role: "user",
        text: "How do I implement a smooth pull-to-refresh swipe gesture in Android Jetpack Compose?",
        timestamp: Date.now() - 120000,
      },
      {
        id: "m-2",
        role: "model",
        text: `In Jetpack Compose, the standard Material 3 pull-to-refresh is provided by \`PullToRefreshBox\`:

\`\`\`kotlin
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*

@Composable
fun RefreshableFeed(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    items: List<String>
) {
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh
    ) {
        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(items) { item ->
                Text(text = item, modifier = Modifier.padding(16.dp))
            }
        }
    }
}
\`\`\`

**Key considerations:**
- \`isRefreshing\` should reflect state from your ViewModel.
- Works smoothly with touch gestures without conflicting with parent scroll containers.`,
        timestamp: Date.now() - 60000,
        tokenCount: 164,
        durationMs: 820,
      },
    ],
    updatedAt: Date.now() - 60000,
    tags: ["Coding", "Android", "Kotlin"],
  },
  {
    id: "template-structured-json",
    title: "Receipt & Invoice JSON Extractor",
    type: "chat",
    config: {
      ...DEFAULT_CONFIG,
      temperature: 0.1,
      responseMimeType: "application/json",
      systemInstruction: "Extract vendor, date, line items, and totals from receipt text into structured JSON matching the provided schema.",
      responseSchemaText: JSON.stringify(
        {
          type: "object",
          properties: {
            vendor: { type: "string" },
            date: { type: "string" },
            currency: { type: "string" },
            totalAmount: { type: "number" },
            lineItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  price: { type: "number" },
                  quantity: { type: "integer" },
                },
                required: ["item", "price"],
              },
            },
          },
          required: ["vendor", "totalAmount", "lineItems"],
        },
        null,
        2
      ),
    },
    messages: [
      {
        id: "ex-1-user",
        role: "user",
        text: "Google Store, Mountain View CA. Oct 14, 2025. Pixel 9 Pro 128GB $999.00, Pixel Stand 2nd Gen $79.00. Tax: $97.02. Total: $1175.02.",
        timestamp: Date.now() - 300000,
      },
      {
        id: "ex-1-model",
        role: "model",
        text: JSON.stringify(
          {
            vendor: "Google Store",
            date: "2025-10-14",
            currency: "USD",
            totalAmount: 1175.02,
            lineItems: [
              { item: "Pixel 9 Pro 128GB", price: 999.0, quantity: 1 },
              { item: "Pixel Stand 2nd Gen", price: 79.0, quantity: 1 },
            ],
          },
          null,
          2
        ),
        timestamp: Date.now() - 290000,
      },
    ],
    updatedAt: Date.now() - 300000,
    tags: ["JSON", "Schema", "Extraction"],
  },
  {
    id: "template-multimodal-vision",
    title: "Mobile Vision & UI Wireframe Analyzer",
    type: "chat",
    config: {
      ...DEFAULT_CONFIG,
      temperature: 0.4,
      systemInstruction: "You are a senior UI/UX designer and mobile developer. Analyze screenshots, wireframes, and UI mockups. Identify layout hierarchy, accessibility contrast flaws, touch target issues, and provide Tailwind CSS or Compose code.",
    },
    messages: [
      {
        id: "v-1",
        role: "user",
        text: "What are the core Android mobile UX improvements needed when adapting a multi-pane desktop web app for a 6.3-inch smartphone?",
        timestamp: Date.now() - 180000,
      },
      {
        id: "v-2",
        role: "model",
        text: `When converting a multi-pane desktop layout (like Google AI Studio) to Android:

1. **Replace Sidebars with Bottom Sheets / Navigation Rails**:
   - Desktop left/right sidebars eat 70% of screen width. On Android, collapse settings into a gesture-dismissible Bottom Sheet or Bottom Navigation bar.
2. **Dynamic Touch Targets**:
   - Minimum 48×48 dp touch bounding boxes for sliders, run buttons, and token badges.
3. **One-Handed Thumb Zone Architecture**:
   - Primary action buttons (Run, Attach, Clear) positioned along the lower third of the screen.
4. **Virtual Keyboard Clearance**:
   - Auto-scroll active input field above the on-screen IME keyboard without shrinking the prompt workspace into an unreadable 50px slit.
5. **Direct Code Export**:
   - One-tap copy to clipboard and share sheet integration for Kotlin, Python, and cURL snippets.`,
        timestamp: Date.now() - 150000,
        tokenCount: 198,
        durationMs: 740,
      },
    ],
    updatedAt: Date.now() - 150000,
    tags: ["UX", "Design", "Vision"],
  },
];
