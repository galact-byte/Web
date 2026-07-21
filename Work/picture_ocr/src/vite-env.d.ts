/// <reference types="vite/client" />

interface LanCollectorItemSnapshot {
  id: string;
  label: string;
  required: boolean;
  imageCount: number;
}

interface LanCollectorAssetSnapshot {
  id: string;
  name: string;
  categoryId: string;
  items: LanCollectorItemSnapshot[];
}

interface LanCollectorSnapshot {
  projectId: string;
  title: string;
  categories: Array<{ id: string; name: string }>;
  assets: LanCollectorAssetSnapshot[];
}

interface LanImageUpload {
  requestId: string;
  projectId: string;
  assetId: string;
  itemId: string;
  image: { fileName: string; data: string; mimeType: string };
}

interface LanAddress {
  name: string;
  address: string;
}

interface LanSessionStatus {
  running: boolean;
  url: string | null;
  addresses: LanAddress[];
}

interface Window {
  evidenceLan?: {
    startSession: (snapshot: LanCollectorSnapshot, selectedAddress?: string) => Promise<LanSessionStatus>;
    stopSession: () => Promise<LanSessionStatus>;
    updateSession: (snapshot: LanCollectorSnapshot) => Promise<LanSessionStatus>;
    getStatus: () => Promise<LanSessionStatus>;
    onImage: (listener: (upload: LanImageUpload) => void) => () => void;
    confirmImageSaved: (requestId: string, outcome: { success: boolean; message?: string }) => void;
  };
}
