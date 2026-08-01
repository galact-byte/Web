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

interface DataLocationInfo {
  current: string;
  isDefault: boolean;
  defaultDir: string;
  startupWarning?: string;
  backup?: { dir: string; createdAt: number; remainingDays: number };
}

interface DataLocationChangeResult {
  changed: boolean;
  dataDir?: string;
  needRestart?: boolean;
  reason?: string;
  error?: string;
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
  evidenceData?: {
    getLocation: () => Promise<DataLocationInfo>;
    chooseLocation: () => Promise<DataLocationChangeResult>;
    resetLocation: () => Promise<DataLocationChangeResult>;
    deleteBackup: () => Promise<{ deleted: boolean; error?: string }>;
    relaunch: () => Promise<void>;
  };
}
