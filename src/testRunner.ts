// Centralized test runner to execute unit test suites
import { testGenerators } from "./utils/codeGenerators.test";
import { testStreamService } from "./services/geminiStreamService.test";
import { testStorage } from "./utils/storage.test";
import { testValidationSchemas } from "./schemas/validation.test";
import { testAuthHelpers } from "./services/auth.test";
import { testSpeechExtractor } from "./utils/speechExtractor.test";
import { testSpeechToText } from "./hooks/useSpeechToText.test";
import { testTokenCounterVisualization } from "./components/TokenCounterVisualization.test";

interface TestSuite {
  name: string;
  run: () => boolean | Promise<boolean>;
}

const suites: TestSuite[] = [
  { name: "Code Generators (Kotlin, TS, Python, cURL)", run: testGenerators },
  { name: "Streaming Service & Error Normalization", run: testStreamService },
  { name: "Storage & State Draft Recovery", run: testStorage },
  { name: "Runtime Zod Validation Schemas", run: testValidationSchemas },
  { name: "Authentication Helpers & Mode Resolution", run: testAuthHelpers },
  { name: "Speech Text Extraction (Code Omission)", run: testSpeechExtractor },
  { name: "Speech-to-Text Environment Safety", run: testSpeechToText },
  { name: "Token Counter Visualization & Formatter", run: testTokenCounterVisualization },
];

async function runAllTests(): Promise<void> {
  console.log("=========================================");
  console.log(" Running Application Test Suites ");
  console.log("=========================================");

  let passed = 0;
  let failed = 0;

  for (const suite of suites) {
    try {
      await suite.run();
      console.log(`PASS: ${suite.name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`FAIL: ${suite.name}`);
      console.error(err instanceof Error ? err.message : String(err));
      failed++;
    }
  }

  console.log("=========================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runAllTests();
