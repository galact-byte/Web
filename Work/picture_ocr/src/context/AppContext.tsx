import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ProjectDocument } from '../types';
import { appReducer, createInitialState, AppState, AppAction } from './appReducer';
import { saveProject, loadProject, createProjectDocument, loadProjectGroup, updateProjectGroupAndSystems } from '../utils/db';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  projectGroupId: string | null;
  updateProjectMeta: (meta: AppState['meta']) => Promise<void>;
  addImageAndSave: (payload: Extract<AppAction, { type: 'ADD_IMAGE' }>['payload']) => Promise<void>;
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

  // Load selected project from IndexedDB.
  useEffect(() => {
    loadedRef.current = false;
    loadProject(projectId)
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
        console.error('Failed to load from IndexedDB:', err);
        const fallbackDoc = createProjectDocument();
        createdAtRef.current = fallbackDoc.createdAt;
        projectGroupIdRef.current = null;
        dispatch({ type: 'LOAD_PROJECT', payload: { ...fallbackDoc, id: projectId} });
        loadedRef.current = true;
      });
  }, [projectId]);

  // Auto-save to IndexedDB (debounced 500ms)
  useEffect(() => {
    if (!loadedRef.current) return; // don't save before first load

    const doc: ProjectDocument = {
      id: projectId,
      groupId: projectGroupIdRef.current,
      meta: state.meta,
      categories: state.categories,
      assets: state.assets,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
    };
    latestDocRef.current = doc;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void enqueueProjectSave(doc)
        .then(() => onProjectSaved?.())
        .catch((err) => {
          console.error('Failed to save to IndexedDB:', err);
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
          console.error('Failed to flush project save on unmount:', err);
        });
      }
    };
  }, []);

  const addImageAndSave = async (payload: Extract<AppAction, { type: 'ADD_IMAGE' }>['payload']) => {
    if (!loadedRef.current) throw new Error('当前项目尚未加载完成。');
    const targetItem = stateRef.current.assets
      .find((asset) => asset.id === payload.assetId)
      ?.items.find((item) => item.id === payload.itemId);
    if (!targetItem) throw new Error('目标资产或检查项已不存在，请在电脑端重新开启采集会话。');
    if (targetItem.images.some((image) => image.id === payload.image.id)) return;

    const action: AppAction = { type: 'ADD_IMAGE', payload };
    const nextState = appReducer(stateRef.current, action);

    const document: ProjectDocument = {
      id: projectId,
      groupId: projectGroupIdRef.current,
      meta: nextState.meta,
      categories: nextState.categories,
      assets: nextState.assets,
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
    };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    stateRef.current = nextState;
    latestDocRef.current = document;
    await enqueueProjectSave(document);
    onProjectSaved?.();
    dispatch(action);
  };

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
    <AppContext.Provider value={{ state, dispatch, projectGroupId: projectGroupIdRef.current, updateProjectMeta, addImageAndSave }}>
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
