import { describe, test } from 'vitest';
import {
  STANDARD_GOOGLE_KEY_REGEX,
  AISTUDIO_PROJECT_KEY_REGEX,
  isValidGoogleApiKeyFormat,
  detectGoogleApiKey,
  maskApiKey,
} from "./keyVerification";
import {
  encryptSecret,
  decryptSecret,
  loadStoredProjects,
  saveAndActivateProject,


  projectsManager,
} from "../utils/storage";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

describe('testKeyVerificationSubsystem', () => {
  test('main', async () => {
  // Test 1: Standard Google API Key pattern validation (AIza + 35 characters = 39 chars total)
  const validStandardKey = "AIzaSyD" + "A".repeat(32); // 4 + 35 = 39 chars
  assert(validStandardKey.length === 39, "Standard key must be 39 chars long");
  assert(STANDARD_GOOGLE_KEY_REGEX.test(validStandardKey), "Valid standard key must match regex");
  assert(isValidGoogleApiKeyFormat(validStandardKey), "isValidGoogleApiKeyFormat must return true for standard key");

  const invalidStandardShort = "AIzaSyD123";
  assert(!STANDARD_GOOGLE_KEY_REGEX.test(invalidStandardShort), "Short key must fail standard regex");

  const invalidPrefix = "BIzaSyD" + "A".repeat(32);
  assert(!STANDARD_GOOGLE_KEY_REGEX.test(invalidPrefix), "Non-AIza prefix must fail standard regex");

  // Test 2: AI Studio project key pattern validation (AQ. + alphanumeric/dash/underscore)
  const validAiStudioKey = "AQ.abcdef1234567890_-xyz";
  assert(AISTUDIO_PROJECT_KEY_REGEX.test(validAiStudioKey), "Valid AI Studio project key must match regex");
  assert(isValidGoogleApiKeyFormat(validAiStudioKey), "isValidGoogleApiKeyFormat must return true for AI Studio key");

  const invalidAiStudioKey = "AQ#invalid_chars!";
  assert(!AISTUDIO_PROJECT_KEY_REGEX.test(invalidAiStudioKey), "Special characters must fail AI Studio regex");

  // Test 3: Key sniffing & embedded pattern detection
  const rawCopiedKey = "AIzaSyB_123456789012345678901234567890Z";
  assert(detectGoogleApiKey(rawCopiedKey) === rawCopiedKey, "detectGoogleApiKey must extract raw key");

  const embeddedText = `export GEMINI_API_KEY="AIzaSyB_123456789012345678901234567890Z"; // comment`;
  assert(
    detectGoogleApiKey(embeddedText) === rawCopiedKey,
    "detectGoogleApiKey must extract embedded standard key"
  );

  const embeddedAiStudio = `Here is my key AQ.alpha1234567890_test for testing`;
  assert(
    detectGoogleApiKey(embeddedAiStudio) === "AQ.alpha1234567890_test",
    "detectGoogleApiKey must extract embedded AI Studio key"
  );

  assert(detectGoogleApiKey("Random text without keys") === null, "detectGoogleApiKey must return null for unrelated text");

  // Test 4: Masked key preview (first 4 and last 4 characters)
  const masked = maskApiKey("AIzaSyB_123456789012345678901234567890Z");
  assert(masked === "AIza...890Z", `Masked preview expected 'AIza...890Z', got '${masked}'`);

  const maskedAiStudio = maskApiKey("AQ.projectKey12345_xyz");
  assert(maskedAiStudio === "AQ.p..._xyz", `Masked AI Studio key preview expected 'AQ.p..._xyz', got '${maskedAiStudio}'`);

  // Test 5: Local encryption envelope
  const plainSecret = "AIzaSySecretTestingKey12345678901234567";
  const encrypted = encryptSecret(plainSecret);
  assert(encrypted.startsWith("enc:"), "Encrypted secret must start with enc: envelope");
  assert(encrypted !== plainSecret, "Encrypted secret must not match plain text");
  const decrypted = decryptSecret(encrypted);
  assert(decrypted === plainSecret, "Decrypted secret must match original plain text");

  // Test 6: Project persistence & active activation
  const testProject = saveAndActivateProject({
    name: "Automated Test Project",
    apiKey: validStandardKey,
    defaultModel: "gemini-2.5-flash",
    isValid: true,
  });

  assert(testProject.id.startsWith("proj_"), "Project must have generated id");
  assert(testProject.defaultModel === "gemini-2.5-flash", "Project default model must be gemini-2.5-flash");

  await Promise.resolve();
  const active = projectsManager.getActiveItem();
  assert(active !== null, "Active project must exist");
  assert(active?.id === testProject.id, "Active project ID must match newly activated project");
  assert(active?.apiKey === validStandardKey, "Active project decrypted API key must match");

  const projects = loadStoredProjects();
  assert(projects.some((p) => p.id === testProject.id), "Project must be present in stored projects list");

  // Cleanup test project
  projectsManager.collection.delete(testProject.id);
  await Promise.resolve(); // wait for cleanup


  });
});
