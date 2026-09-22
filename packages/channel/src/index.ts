// The package's single public entry: each end raises its own channel and never reaches into a
// module of this package (A-21). The generic core behind both ends stays internal.

export { createHostChannel } from './hostChannel.js';
export type { HostChannel } from './hostChannel.js';
export { createViewerChannel } from './viewerChannel.js';
export type { ViewerChannel } from './viewerChannel.js';
export { INITIAL_CHANNEL_STATE } from './outbox.js';
export type { ChannelState } from './outbox.js';
export type { MessageHandlers } from './createChannel.js';
export type { PayloadOf } from './buildMessage.js';
export { createDisposerSet } from './disposers.js';
