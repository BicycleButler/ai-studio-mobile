import { describe, it, expect } from 'vitest';
import { calculateProportionalDimensions } from './imageCompressor';

describe('imageCompressor', () => {
  describe('calculateProportionalDimensions', () => {
    it('should not scale if dimensions are smaller than max', () => {
      const result = calculateProportionalDimensions(100, 100, 1000);
      expect(result).toEqual({ width: 100, height: 100 });
    });

    it('should scale down width properly', () => {
      const result = calculateProportionalDimensions(2000, 1000, 1000);
      expect(result).toEqual({ width: 1000, height: 500 });
    });

    it('should scale down height properly', () => {
      const result = calculateProportionalDimensions(1000, 2000, 1000);
      expect(result).toEqual({ width: 500, height: 1000 });
    });
  });
});
