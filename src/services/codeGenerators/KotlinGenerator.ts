import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class KotlinGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "kotlin";
  readonly name: string = "MainActivity.kt";
  readonly language: string = "kotlin";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);

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
        ${sysInst ? `systemInstruction = content { text("${sysInst}") }\n    ` : ""}
    )

    runBlocking {
        val response = generativeModel.generateContent("${promptText}")
        println(response.text)
    }
}
`;
  }
}
