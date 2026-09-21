import { readViewerVersion } from './viewerVersion.js';
import type {
  CustomizationModuleEntry,
  OverlayItemCustomization,
} from './getCustomizationModule.props.js';

const VERSION_NUMBER = readViewerVersion() ?? '';

// Least crowded corner; top-right is empty but hosts the viewport action menus.
const VERSION_OVERLAY_CUSTOMIZATION_ID = 'viewportOverlay.bottomRight';

const versionOverlayItem: OverlayItemCustomization = {
  id: 'scoringBridgeVersion',
  inheritsFrom: 'ohif.overlayItem',
  title: 'OHIF viewer version',
  // contentF, not `label`: one text node (CustomizableViewportOverlay.tsx:380-397).
  contentF: () => (VERSION_NUMBER ? `OHIF ${VERSION_NUMBER}` : null),
};

export const getCustomizationModule = (): CustomizationModuleEntry[] => [
  {
    // Merged in registration order after cornerstone, so $push appends to its overlay list
    // (CustomizationService.ts:118-131,381-397).
    name: 'default',
    value: {
      [VERSION_OVERLAY_CUSTOMIZATION_ID]: {
        $push: [versionOverlayItem],
      },
    },
  },
];
