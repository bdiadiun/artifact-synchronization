import type { CommandDelivery } from './delivery.props';

export interface HostChannelDeps {
  viewerOrigin: string;
  hostWindow: Window;
  exchangeTimeoutMs?: number;
  deliver: CommandDelivery;
  onIgnoredOrigin: (origin: string) => void;
}
