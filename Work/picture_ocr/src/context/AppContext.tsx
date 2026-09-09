import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import type { ImageData, ProjectDocument } from '../types';
import { appReducer, createInitialState, AppState, AppAction } from './appReducer';
import {
  saveProject,
  loadProject,
  createProjectDocument,
  loadProjectGroup,
  updateProjectGroupAndSystems,
  addImageToProject,
  removeImageFromProject,
  ensureProjectImagesMigrated,
} from '../utils/db';
import { clearImageCache, invalidateImage, primeImageCache } from '../utils/imageCache';
import { reportCriticalError } from '../utils/errorLog';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  /** 当前打开的项目 id：图片字节按 `${projectId}:${imageId}` 存放，显示时必须带上。 */
  projectId: string;
  projectGroupId: string | null;
  updateProjectMeta: (meta: AppState['meta']) => Promise<void>;
  addImageAndSave: (payload: Extract<AppAction, { type: 'ADD_IMAGE' }>['payload']) => Promise<void>;
  removeImageAndSave: (assetId: string, itemId: string, imageId: string) => Promise<void>;
}

interface AppProviderProps {
  children: React.ReactNode;
  projectId: string;
  onProjectSaved?: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children, projectId, onProjectSaved }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const createdAtRef = useRef<number>(Date.now());
  const projectGroupIdRef = useRef<string | null>(null);
  const latestDocRef = useRef<ProjectDocument | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  const enqueueProjectSave = (doc: ProjectDocument): Promise<void> => {
    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveProject(doc));
    saveQueueRef.current = operation.catch(() => undefined);
    return operation;
  };

  /** 从某个状态快照构造待保存文档：图片此时只有元数据引用，文档体积回到 KB 级。 */
  const buildDocument = (snapshot: AppState): ProjectDocument => ({
    id: projectId,
    groupId: projectGroupIdRef.current,
    meta: snapshot.meta,
    categories: snapshot.categories,
    assets: snapshot.assets,
    createdAt: createdAtRef.current,
    updatedAt: Date.now(),
  });

  // Load selected project from IndexedDB.
  useEffect(() => {
    loadedRef.current = false;
    // 打开前先把内联图片字节搬到独立 store：之后每次自动保存只重写轻量文档，
    // 不再把整份上百 MB 的 Base64 重新写一遍（这正是拍照时卡死的根因）。
    ensureProjectImagesMigrated(projectId)
      .catch(() => false)
      .then(() => loadProject(projectId))
      .then((doc) => {
        if (doc) {
          createdAtRef.current = doc.createdAt;
          projectGroupIdRef.current = doc.groupId;
          dispatch({ type: 'LOAD_PROJECT', payload: doc });
        } else {
          const fallbackDoc = createProjectDocument();
          createdAtRef.current = fallbackDoc.createdAt;
          projectGroupIdRef.current = null;
          dispatch({ type: 'LOAD_PROJECT', payload: { ...fallbackDoc, id: projectId } });
        }
        loadedRef.current = true;
      })
      .catch((err) => {
        // 关键：读失败时绝不能用空白模板顶替并进入可保存状态——旧逻辑会在 500ms 后把空文档写回去，
        // 直接清空真实项目（大文档读取超时就会触发）。这里保持 loadedRef=false，禁掉自动保存。
        loadedRef.current = false;
        reportCriticalError({
          type: 'manual',
          message: `项目读取失败，已暂停自动保存以免覆盖原有数据，请重新打开该项目：${err instanceof Error ? err.message : String(err)}`,
          stack: err instanceof Error ? err.stack : undefined,
          context: 'app:loadProject',
        });
      });
    return () => {
      // 切走项目时释放图片缓存，避免多个项目的 Base64 常驻内存。
      clearImageCache(projectId);
    };
  }, [projectId]);

  // Auto-save to IndexedDB (debounced 500ms)
  useEffect(() => {
    if (!loadedRef.current) return; // don't save before first load

    const doc = buildDocument(state);
    latestDocRef.current = doc;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void enqueueProjectSave(doc)
        .then(() => onProjectSaved?.())
        .catch((err) => {
          // 保存失败必须让用户看到：否则刚拍的照片只存在内存里，关闭窗口就静默丢失。
          reportCriticalError({
            type: 'manual',
            message: `项目保存失败，刚的修改可能未写入，请勿关闭窗口并重试：${err instanceof Error ? err.message : String(err)}`,
            stack: err instanceof Error ? err.stack : undefined,
            context: 'app:autoSave',
          });
        });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [projectId, state.meta, state.categories, state.assets, onProjectSaved]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (latestDocRef.current) {
        void enqueueProjectSave({ ...latestDocRef.current, updatedAt: Date.now() }).catch((err) => {
          reportCriticalError({
            type: 'manual',
            message: `退出项目时的最后一次保存失败，请重新打开项目确认内容：${err instanceof Error ? err.message : String(err)}`,
            stack: err instanceof Error ? err.stack : undefined,
            context: 'app:flushSave',
          });
        });
      }
    };
  }, []);

  const addImageAndSave = useCallback(async (payload: Extract<AppAction, { type: 'ADD_IMAGE' }>['payload']) => {
    if (!loadedRef.current) throw new Error('当前项目尚未加载完成。');
    const targetItem = stateRef.current.assets
      .find((asset) => asset.id === payload.assetId)
      ?.items.find((item) => item.id === payload.itemId);
    if (!targetItem) throw new Error('目标资产或检查项已不存在，请在电脑端重新开启采集会话。');
    if (targetItem.images.some((image) => image.id === payload.image.id)) return;

    // 字节单独入库、文档在库里现读现改：不再用内存快照整份覆盖，
    // 因此手机上传与电脑端同时添加图片不会互相把对方的照片冲掉。
    await addImageToProject(projectId, payload.assetId, payload.itemId, payload.image);
    if (typeof payload.image.data === 'string' && payload.image.data.length > 0) {
      primeImageCache(projectId, new Map([[payload.image.id, payload.image.data]]));
    }

    const { data: _inline, ...reference } = payload.image;
    const action: AppAction = { type: 'ADD_IMAGE', payload: { ...payload, image: reference as ImageData } };
    const nextState = appReducer(stateRef.current, action);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    stateRef.current = nextState;
    latestDocRef.current = buildDocument(nextState);
    onProjectSaved?.();
    dispatch(action);
  }, [projectId, onProjectSaved]);

  const removeImageAndSave = useCallback(async (assetId: string, itemId: string, imageId: string) => {
    // 同事务删掉文档引用与字节，避免删完图片字节仍占着几十 MB 空间。
    await removeImageFromProject(projectId, assetId, itemId, imageId);
    invalidateImage(projectId, imageId);
    const action: AppAction = { type: 'REMOVE_IMAGE', payload: { assetId, itemId, imageId } };
    stateRef.current = appReducer(stateRef.current, action);
    latestDocRef.current = buildDocument(stateRef.current);
    dispatch(action);
  }, [projectId]);

  const updateProjectMeta = async (meta: AppState['meta']) => {
    const groupId = projectGroupIdRef.current;
    if (groupId) {
      const group = await loadProjectGroup(groupId);
      if (group) {
        await updateProjectGroupAndSystems({
          ...group,
          projectCode: meta.projectCode,
          projectName: meta.projectName,
          unitName: meta.unitName,
          reportDate: meta.reportDate,
          updatedAt: Date.now(),
        });
      }
    }
    dispatch({ type: 'SET_META', payload: meta });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, projectId, projectGroupId: projectGroupIdRef.current, updateProjectMeta, removeImageAndSave, addImageAndSave }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
}

export function useAppState(): AppState {
  return useAppContext().state;
}

export function useDispatch(): React.Dispatch<AppAction> {
  return useAppContext().dispatch;
}
