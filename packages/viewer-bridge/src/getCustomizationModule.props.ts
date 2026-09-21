export interface OverlayItemCustomization {
  id: string;
  inheritsFrom: string;
  title: string;
  contentF: () => string | null;
}

export interface CustomizationModuleEntry {
  name: string;
  value: Record<string, { $push: OverlayItemCustomization[] }>;
}
