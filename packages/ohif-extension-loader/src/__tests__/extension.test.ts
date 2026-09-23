import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCORING_VIEWER_EXTENSION_ID } from '@bdiadiun/ohif-extension-scoring-viewer';
import type { OhifExtensionManager, OhifExtensionParams } from '@bdiadiun/ohif-extension-scoring-viewer';

import { extensionLoader, EXTENSION_LOADER_ID } from '../extension.js';

const baseParams = (extensionManager?: OhifExtensionManager): OhifExtensionParams => ({
  servicesManager: { services: {} },
  commandsManager: { runCommand: vi.fn() },
  extensionManager,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('extensionLoader', () => {
  it('carries the package name as its own id', () => {
    const extension = extensionLoader;

    expect(extension.id).toBe('@bdiadiun/ohif-extension-loader');
    expect(extension.id).toBe(EXTENSION_LOADER_ID);
  });

  it('reports a missing extension manager instead of registering anything', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const extension = extensionLoader;

    await extension.preRegistration?.(baseParams(undefined));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no extension manager was passed'));
  });

  it('registers exactly one child, the scoring viewer, through the extension manager it is handed', async () => {
    const manager: OhifExtensionManager = { registerExtension: vi.fn() };
    const extension = extensionLoader;

    await extension.preRegistration?.(baseParams(manager));

    expect(manager.registerExtension).toHaveBeenCalledTimes(1);
    expect(manager.registerExtension).toHaveBeenCalledWith(
      expect.objectContaining({ id: SCORING_VIEWER_EXTENSION_ID }),
    );
  });

  it('reports a registration that fails instead of throwing out of preRegistration', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const manager: OhifExtensionManager = {
      registerExtension: vi.fn().mockRejectedValue(new Error('the viewer refused the extension')),
    };
    const extension = extensionLoader;

    await expect(extension.preRegistration?.(baseParams(manager))).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(SCORING_VIEWER_EXTENSION_ID), expect.any(Error));
  });
});
