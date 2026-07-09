import type { ProjectDocument, ProjectMeta, ProjectSummary, Category, Asset } from '../types';
import defaultCategories, { createDefaultMeta, createPresetAssets } from '../data/defaults';

const DB_NAME = 'evidence-collector-db';
const DB_VERSION = 2;
const LEGACY_STORE_NAME = 'project';
const PROJECTS_STORE_NAME = 'projects';
const LEGACY_PROJECT_ID = 'current';
const MANAGEMENT_CATEGORY_ID = 'cat-management';
const MANAGEMENT_POLICY_ASSET_NAME = '制度';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        const legacyStore = db.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'id' });
        legacyStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
        const projectsStore = db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
        projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createProjectDocument(overrides: Partial<ProjectMeta> = {}): ProjectDocument {
  const now = Date.now();
  const categories = cloneCategories(defaultCategories);
  const meta = normalizeMeta({ ...createDefaultMeta(), ...overrides });
  return normalizeProjectDocument({
    id: genProjectId(),
    meta,
    categories,
    assets: createPresetAssets(categories),
    createdAt: now,
    updatedAt: now,
  });
}

export function normalizeProjectDocument(doc: Partial<ProjectDocument> & { id?: string }): ProjectDocument {
  const now = Date.now();
  const categories = normalizeCategories(doc.categories);
  const normalizedDoc: ProjectDocument = {
    id: doc.id || genProjectId(),
    meta: normalizeMeta(doc.meta),
    categories,
    assets: cloneAssets(doc.assets ?? []),
    createdAt: doc.createdAt || doc.updatedAt || now,
    updatedAt: doc.updatedAt || now,
  };
  return ensureManagementPolicyAsset(normalizedDoc);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await migrateLegacyProjectIfNeeded();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      const projects = (request.result as ProjectDocument[])
        .map((doc) => normalizeProjectDocument(doc))
        .map(toProjectSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(projects);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function saveProject(doc: ProjectDocument): Promise<void> {
  const db = await openDB();
  const normalizedDoc = normalizeProjectDocument(doc);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE_NAME);
    store.put(normalizedDoc);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadProject(projectId: string): Promise<ProjectDocument | null> {
  await migrateLegacyProjectIfNeeded();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readonly');
    const store = tx.objectStore(PROJECTS_STORE_NAME);
    const request = store.get(projectId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ? normalizeProjectDocument(request.result) : null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECTS_STORE_NAME);
    store.delete(projectId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function migrateLegacyProjectIfNeeded(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
      db.close();
      resolve();
      return;
    }

    const tx = db.transaction([LEGACY_STORE_NAME, PROJECTS_STORE_NAME], 'readwrite');
    const legacyStore = tx.objectStore(LEGACY_STORE_NAME);
    const projectsStore = tx.objectStore(PROJECTS_STORE_NAME);
    const countRequest = projectsStore.count();

    countRequest.onsuccess = () => {
      if (countRequest.result > 0) return;

      const legacyRequest = legacyStore.get(LEGACY_PROJECT_ID);
      legacyRequest.onsuccess = () => {
        if (!legacyRequest.result) return;
        const migrated = normalizeProjectDocument({
          ...legacyRequest.result,
          id: LEGACY_PROJECT_ID,
        });
        projectsStore.put(migrated);
      };
      legacyRequest.onerror = () => {
        reject(legacyRequest.error);
      };
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function normalizeMeta(meta: Partial<ProjectMeta> | undefined): ProjectMeta {
  const legacyMeta = meta as (Partial<ProjectMeta> & { evaluator?: string }) | undefined;
  const defaults = createDefaultMeta();
  return {
    projectCode: legacyMeta?.projectCode ?? '',
    projectName: legacyMeta?.projectName ?? defaults.projectName,
    unitName: legacyMeta?.unitName ?? defaults.unitName,
    systemName: legacyMeta?.systemName ?? '',
    reportDate: legacyMeta?.reportDate ?? defaults.reportDate,
  };
}

function normalizeCategories(categories: Category[] | undefined): Category[] {
  const source = categories && categories.length > 0 ? categories : defaultCategories;
  return cloneCategories(source);
}

function ensureManagementPolicyAsset(doc: ProjectDocument): ProjectDocument {
  const hasManagementCategory = doc.categories.some((category) => category.id === MANAGEMENT_CATEGORY_ID);
  if (!hasManagementCategory) return doc;

  const hasPolicyAsset = doc.assets.some(
    (asset) =>
      asset.categoryId === MANAGEMENT_CATEGORY_ID &&
      asset.name.trim() === MANAGEMENT_POLICY_ASSET_NAME
  );
  if (hasPolicyAsset) return doc;

  return {
    ...doc,
    assets: [
      ...doc.assets,
      {
        id: genProjectId(),
        name: MANAGEMENT_POLICY_ASSET_NAME,
        categoryId: MANAGEMENT_CATEGORY_ID,
        items: [],
      },
    ],
  };
}

function toProjectSummary(doc: ProjectDocument): ProjectSummary {
  return {
    id: doc.id,
    meta: doc.meta,
    assetCount: doc.assets.length,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function cloneCategories(categories: Category[]): Category[] {
  return categories.map((category) => ({
    ...category,
    defaultItems: (category.defaultItems ?? []).map((item) => ({ ...item })),
  }));
}

function cloneAssets(assets: Asset[]): Asset[] {
  return assets.map((asset) => ({
    ...asset,
    items: (asset.items ?? []).map((item) => ({
      ...item,
      images: (item.images ?? []).map((image) => ({ ...image })),
    })),
  }));
}

function genProjectId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
