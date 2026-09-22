import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCORING_BRIDGE_EXTENSION_ID } from '@bdiadiun/ohif-extension-scoring-bridge';
import type {
  OhifExtensionManager,
  OhifExtensionParams,
} from '@bdiadiun/ohif-extension-scoring-bridge';

import { createScoringAdapterExtension, SCORING_ADAPTER_EXTENSION_ID } from '../extension.js';

const baseParams = (extensionManager?: OhifExtensionManager): OhifExtensionParams => ({
  servicesManager: { services: {} },
  commandsManager: { runCommand: vi.fn() },
  extensionManager,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createScoringAdapterExtension', () => {
  it('carries the package name as its own id', () => {
    const extension = createScoringAdapterExtension();

    expect(extension.id).toBe('@bdiadiun/ohif-extension-scoring-adapter');
    expect(extension.id).toBe(SCORING_ADAPTER_EXTENSION_ID);
  });

  it('reports a missing extension manager instead of registering anything', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extension = createScoringAdapterExtension();

    await extension.preRegistration(baseParams(undefined));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no extension manager was passed'),
    );
  });

  it('registers exactly one child, the bridge, through the extension manager it is handed', async () => {
    const manager: OhifExtensionManager = { registerExtension: vi.fn() };
    const extension = createScoringAdapterExtension();

    await extension.preRegistration(baseParams(manager));

    expect(manager.registerExtension).toHaveBeenCalledTimes(1);
    expect(manager.registerExtension).toHaveBeenCalledWith(
      expect.objectContaining({ id: SCORING_BRIDGE_EXTENSION_ID }),
    );
  });

  it('reports a registration that fails instead of throwing out of preRegistration', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const manager: OhifExtensionManager = {
      registerExtension: vi.fn().mockRejectedValue(new Error('the viewer refused the extension')),
    };
    const extension = createScoringAdapterExtension();

    await expect(extension.preRegistration(baseParams(manager))).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(SCORING_BRIDGE_EXTENSION_ID),
      expect.any(Error),
    );
  });
});
