import { useSyncExternalStore } from 'react';
import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import type { Channel, ChannelState } from './channel.js';

export const useChannelState = <TIn extends BridgeMessage>(channel: Channel<TIn>): ChannelState =>
  useSyncExternalStore(channel.subscribe, channel.getState);
