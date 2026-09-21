import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('registers its children through the extension manager it is handed', async () => {
    const manager: OhifExtensionManager = { registerExtension: vi.fn() };
    const extension = createScoringAdapterExtension({ hostOrigin: 'https://form.example.com' });

    await extension.preRegistration(baseParams(manager));

    expect(manager.registerExtension).toHaveBeenCalledTimes(1);
    expect(manager.registerExtension).toHaveBeenCalledWith(
      expect.objectContaining({ id: '@bdiadiun/ohif-extension-scoring-bridge' }),
    );
  });
});
