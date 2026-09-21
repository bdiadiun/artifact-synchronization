import type { OhifServicesManager } from './ohif.props.js';
import type { PostToHost } from './messaging.props.js';

export interface HandshakeDeps {
  servicesManager: OhifServicesManager;
  hostOrigin: string;
  post: PostToHost;
}

export interface Handshake {
  dispose: () => void;
}
