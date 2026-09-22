import type { MetricKey, ToolName } from './vocabulary.props';

// Adding a message shape stays within version 1; only a breaking change bumps it.
export const CONTRACT_VERSION = 1 as const;

// Each vocabulary is written once, as the tuple the guards test against; `vocabulary.props.ts`
// derives the matching type from it, so a value and its type can never drift apart.
export const UNIT_VALUES = ['mm2', 'px2', 'mm', 'px'] as const;

export const TOOL_NAME_VALUES = ['EllipticalROI', 'RectangleROI', 'Length'] as const;

export const METRIC_KEY_BY_TOOL = {
  EllipticalROI: 'area',
  RectangleROI: 'area',
  Length: 'length',
} as const satisfies Record<ToolName, MetricKey>;
