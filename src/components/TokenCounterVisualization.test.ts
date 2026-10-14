import { describe, test } from 'vitest';
import { formatTokenNumber } from "./TokenCounterVisualization";

describe('testTokenCounterVisualization', () => {
  test('main', () => {
  // Test 1: Number formatting for small numbers
  if (formatTokenNumber(0) !== "0") {
    throw new Error(`Expected formatTokenNumber(0) to be "0", got "${formatTokenNumber(0)}"`);
  }
  if (formatTokenNumber(450) !== "450") {
    throw new Error(`Expected formatTokenNumber(450) to be "450", got "${formatTokenNumber(450)}"`);
  }

  // Test 2: Formatting thousands
  if (formatTokenNumber(12000) !== "12k") {
    throw new Error(`Expected formatTokenNumber(12000) to be "12k", got "${formatTokenNumber(12000)}"`);
  }
  if (formatTokenNumber(12500) !== "12.5k") {
    throw new Error(`Expected formatTokenNumber(12500) to be "12.5k", got "${formatTokenNumber(12500)}"`);
  }

  // Test 3: Formatting millions
  if (formatTokenNumber(1000000) !== "1M") {
    throw new Error(`Expected formatTokenNumber(1000000) to be "1M", got "${formatTokenNumber(1000000)}"`);
  }
  if (formatTokenNumber(2500000) !== "2.5M") {
    throw new Error(`Expected formatTokenNumber(2500000) to be "2.5M", got "${formatTokenNumber(2500000)}"`);
  }


  });
});
