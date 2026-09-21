import { describe, expect, it } from 'vitest';
import * as contract from '../index';

describe('package entry', () => {
  it('exports every value the rest of the repository imports from @bdiadiun/scoring-contract', () => {
    expect(typeof contract.CONTRACT_VERSION).toBe('number');
    expect(typeof contract.METRIC_KEY_BY_TOOL).toBe('object');
    expect(Array.isArray(contract.TOOL_NAME_VALUES)).toBe(true);
    expect(typeof contract.isRecord).toBe('function');
    expect(typeof contract.isNonEmptyString).toBe('function');
    expect(typeof contract.isToolName).toBe('function');
    expect(typeof contract.isMeasurementGeometry).toBe('function');
    expect(Array.isArray(contract.HOST_COMMAND_TYPES)).toBe(true);
    expect(typeof contract.isHostCommand).toBe('function');
    expect(Array.isArray(contract.VIEWER_EVENT_TYPES)).toBe(true);
    expect(typeof contract.isViewerEvent).toBe('function');
  });
});
