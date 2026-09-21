import { describe, expect, it } from 'vitest';
import { METRIC_KEY_BY_TOOL, TOOL_NAME_VALUES } from '../vocabulary';
import type { MetricKey } from '../vocabulary.props';

describe('METRIC_KEY_BY_TOOL', () => {
  // A Record keyed by every ToolName: a tool added to TOOL_NAME_VALUES without an entry here
  // fails to compile, and a wrong entry fails the assertion below.
  const expectedMetricKeyByTool: Record<(typeof TOOL_NAME_VALUES)[number], MetricKey> = {
    EllipticalROI: 'area',
    RectangleROI: 'area',
    Length: 'length',
  };

  it.each(TOOL_NAME_VALUES)('maps %s to its metric key', (toolName) => {
    expect(METRIC_KEY_BY_TOOL[toolName]).toBe(expectedMetricKeyByTool[toolName]);
  });
});
