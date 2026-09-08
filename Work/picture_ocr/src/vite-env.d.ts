/// <reference types="vite/client" />

// 构建期注入的应用版本号（见 vite.config.ts 的 define）。
declare const __APP_VERSION__: string;

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

interface LanCollectorSystem {
  projectId: string;
  title: string;
  categories: Array<{ id: string; name: string }>;
  assets: LanCollectorAssetSnapshot[];
}

interface LanCollectorSnapshot {
  groupId: string | null;
  groupTitle: string;
  systems: LanCollectorSystem[];
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
