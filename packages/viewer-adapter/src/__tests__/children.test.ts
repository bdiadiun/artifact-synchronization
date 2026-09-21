import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCORING_BRIDGE_EXTENSION_ID } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { OhifExtensionParams } from '@bdiadiun/ohif-extension-scoring-bridge';

import { createChildren } from '../children.js';

const baseParams: OhifExtensionParams = {
  servicesManager: { services: {} },
  commandsManager: { runCommand: vi.fn() },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createChildren', () => {
  it('declares the bridge as the one child, under its own extension id', () => {
    const { extensions } = createChildren({});

    expect(extensions).toHaveLength(1);
    expect(extensions[0].id).toBe(SCORING_BRIDGE_EXTENSION_ID);
  });

  it('forwards the configured host origin to the bridge child', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { extensions } = createChildren({ hostOrigin: 'https://form.example.com' });

    extensions[0].preRegistration(baseParams);

    expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('leaves the bridge child unconfigured when no host origin is given anywhere', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { extensions } = createChildren({});

    extensions[0].preRegistration(baseParams);

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
  });
});
