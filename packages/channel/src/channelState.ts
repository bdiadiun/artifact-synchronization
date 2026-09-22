export interface ChannelState {
  ready: boolean;
  queued: number;
}

export const INITIAL_CHANNEL_STATE: ChannelState = { ready: false, queued: 0 };
