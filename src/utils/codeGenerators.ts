import { PromptConfig, ChatMessage } from "../types";

export function generatePythonCode(config: PromptConfig, messages: ChatMessage[]): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const promptText = lastUserMsg?.text || "Hello Gemini!";

  return `import os
from google import genai
from google.genai import types

# Initialize client (uses GEMINI_API_KEY from environment)
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

response = client.models.generate_content(
    model="${config.model}",
    contents="${promptText.replace(/"/g, '\\"')}",
    config=types.GenerateContentConfig(
        ${config.systemInstruction ? `system_instruction="${config.systemInstruction.replace(/"/g, '\\"')}",\n        ` : ""}temperature=${config.temperature},
        top_p=${config.topP},
        top_k=${config.topK},
        max_output_tokens=${config.maxOutputTokens},
        ${config.responseMimeType === "application/json" ? `response_mime_type="application/json",\n        ` : ""}
    ),
)

print(response.text)
`;
}

export function generateTypeScriptCode(config: PromptConfig, messages: ChatMessage[]): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const promptText = lastUserMsg?.text || "Hello Gemini!";

  return `import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  const response = await ai.models.generateContent({
    model: "${config.model}",
    contents: "${promptText.replace(/"/g, '\\"')}",
    config: {
      ${config.systemInstruction ? `systemInstruction: "${config.systemInstruction.replace(/"/g, '\\"')}",\n      ` : ""}temperature: ${config.temperature},
      topP: ${config.topP},
      topK: ${config.topK},
      maxOutputTokens: ${config.maxOutputTokens},
      ${config.responseMimeType === "application/json" ? `responseMimeType: "application/json",\n      ` : ""}
    },
  });

  console.log(response.text);
}

main();
`;
}

export function generateAndroidKotlinCode(config: PromptConfig, messages: ChatMessage[]): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const promptText = lastUserMsg?.text || "Hello Gemini!";

  return `// In your Android app build.gradle.kts:
// implementation("com.google.ai.client.generativeai:generativeai:0.9.0")

package com.example.aistudio

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.coroutines.runBlocking

fun main() {
    val config = generationConfig {
        temperature = ${config.temperature}f
        topP = ${config.topP}f
        topK = ${config.topK}
        maxOutputTokens = ${config.maxOutputTokens}
    }

    val generativeModel = GenerativeModel(
        modelName = "${config.model}",
        apiKey = BuildConfig.GEMINI_API_KEY,
        generationConfig = config,
        ${config.systemInstruction ? `systemInstruction = content { text("${config.systemInstruction.replace(/"/g, '\\"')}") }\n    ` : ""}
    )

    runBlocking {
        val response = generativeModel.generateContent("${promptText.replace(/"/g, '\\"')}")
        println(response.text)
    }
}
`;
}

export function generateCurlCode(config: PromptConfig, messages: ChatMessage[]): string {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const promptText = lastUserMsg?.text || "Hello Gemini!";

  return `curl "https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=\${GEMINI_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "contents": [{
      "parts": [{"text": "${promptText.replace(/"/g, '\\"')}"}]
    }],
    "generationConfig": {
      "temperature": ${config.temperature},
      "topP": ${config.topP},
      "topK": ${config.topK},
      "maxOutputTokens": ${config.maxOutputTokens}
    }
  }'
`;
}
