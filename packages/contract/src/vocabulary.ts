import type { MetricKey, ToolName, Unit } from './vocabulary.props';

// Adding a message shape stays within version 1; only a breaking change bumps it.
export const CONTRACT_VERSION = 1 as const;

export const UNIT_VALUES: readonly Unit[] = ['mm2', 'px2', 'mm', 'px'];

export const TOOL_NAME_VALUES: readonly ToolName[] = ['EllipticalROI', 'RectangleROI', 'Length'];

export const METRIC_KEY_BY_TOOL: Record<ToolName, MetricKey> = {
  EllipticalROI: 'area',
  RectangleROI: 'area',
  Length: 'length',
};
