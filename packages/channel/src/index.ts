// The package's single public entry: both ends import from `@bdiadiun/scoring-channel` and never
// reach into a module of it (A-21).

export { createChannel } from './createChannel.js';
export type { AnswerMessage, Channel, ChannelOptions } from './createChannel.props.js';
export type { MessageOfType, PayloadOf } from './buildMessage.js';
export { createPeerPost } from './peerPost.js';
export type { PeerPost, PeerPostOptions } from './peerPost.js';
export { createIncomingMessages } from './incomingMessages.js';
export type { IncomingMessages, IncomingMessagesOptions } from './incomingMessages.js';
export { createDisposerSet } from './disposers.js';
export type { Disposable, Disposer, DisposerSet, DisposerSetOptions } from './disposers.js';
