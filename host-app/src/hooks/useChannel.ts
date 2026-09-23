import { useChannelState, type ChannelState } from '@bdiadiun/scoring-channel';
import { channel } from '@app/services/channel';

// The channel's `{ ready, queued, announcements }`, for the status line and the form.
export const useChannel = (): ChannelState => useChannelState(channel);
