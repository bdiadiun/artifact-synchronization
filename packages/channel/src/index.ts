// The package's single public entry: both ends import from `@bdiadiun/scoring-channel` and never
// reach into a module of it (A-21).

export { createChannel } from './createChannel.js';
export type { AnswerMessage, Channel, ChannelOptions } from './createChannel.props.js';
export type { MessageOfType, PayloadOf } from './buildMessage.props.js';
export { createPeerPost } from './peerPost.js';
export type { PeerPost, PeerPostOptions } from './peerPost.props.js';
export { createIncomingMessages } from './incomingMessages.js';
export type { IncomingMessages, IncomingMessagesOptions } from './incomingMessages.props.js';
export { DEFAULT_EXCHANGE_TIMEOUT_MS } from './config.js';
