import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScoringBridgeExtension } from '../extension.js';
import type { OhifExtensionParams } from '../ohif.props.js';

const baseParams: OhifExtensionParams = {
  servicesManager: { services: {} },
  commandsManager: { runCommand: vi.fn() },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createScoringBridgeExtension', () => {
  it('leaves the bridge inert when no host origin is configured anywhere', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extension = createScoringBridgeExtension();

    extension.preRegistration(baseParams);

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
    expect(addSpy).not.toHaveBeenCalledWith('pagehide', expect.anything());
    expect(errorSpy).toHaveBeenCalled();
  });

  it('leaves the bridge inert when the configured host origin is an empty string', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extension = createScoringBridgeExtension({ hostOrigin: '' });

    extension.preRegistration(baseParams);

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
  });

  it('does not fall back to a permissive origin when appConfig carries none either', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extension = createScoringBridgeExtension();

    extension.preRegistration({ ...baseParams, appConfig: {} });

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
  });

  it('arms the bridge once a host origin is configured', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const extension = createScoringBridgeExtension({ hostOrigin: 'https://form.example.com' });

    extension.preRegistration(baseParams);

    expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
