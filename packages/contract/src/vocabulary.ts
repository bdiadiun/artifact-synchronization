import type { MetricKey, ToolName } from './vocabulary.props';

export const UNIT_VALUES = ['mm2', 'px2', 'mm', 'px'] as const;

export const TOOL_NAME_VALUES = ['EllipticalROI', 'RectangleROI', 'Length'] as const;

export const METRIC_KEY_BY_TOOL = {
  EllipticalROI: 'area',
  RectangleROI: 'area',
  Length: 'length',
} as const satisfies Record<ToolName, MetricKey>;
