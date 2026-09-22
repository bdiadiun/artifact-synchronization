import { useSyncExternalStore } from 'react';
import {
  INITIAL_CHANNEL_STATE,
  type ChannelState,
  type HostChannel,
} from '@bdiadiun/scoring-channel';

// Stable identities for the first render, before the mount effect has created the channel: a new
// function per render would make `useSyncExternalStore` resubscribe on every one.
const subscribeToNothing = (): (() => void) => (): void => undefined;
const readInitialState = (): ChannelState => INITIAL_CHANNEL_STATE;

export const useChannelState = (channel: HostChannel | null): ChannelState =>
  useSyncExternalStore(
    channel?.subscribe ?? subscribeToNothing,
    channel?.getState ?? readInitialState,
  );
