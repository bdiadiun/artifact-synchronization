import type { OhifExtension, OhifExtensionManager } from '@bdiadiun/ohif-extension-scoring-bridge';
import { LOG_PREFIX } from './config.js';

// Sequential and awaited: registerExtension runs each child's own preRegistration and is async
// (ExtensionManager.ts:251-286), and the order the children are declared in is the order they get.
export const registerChildren = async (
  extensionManager: OhifExtensionManager,
  children: readonly OhifExtension[],
): Promise<void> => {
  for (const child of children) {
    try {
      await extensionManager.registerExtension(child);
    } catch (error) {
      console.error(
        `${LOG_PREFIX} ${child.id} was not registered; the remaining extensions still are`,
        error,
      );
    }
  }
};
