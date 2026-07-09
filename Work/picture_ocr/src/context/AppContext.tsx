import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ProjectDocument } from '../types';
import { appReducer, createInitialState, AppState, AppAction } from './appReducer';
import { saveProject, loadProject } from '../utils/db';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load data from IndexedDB on mount
  useEffect(() => {
    loadProject()
      .then((doc) => {
        if (doc) {
          dispatch({ type: 'LOAD_PROJECT', payload: doc });
        } else {
          // First time: use defaults with presets
          dispatch({ type: 'CLEAR_PROJECT' });
        }
        loadedRef.current = true;
      })
      .catch((err) => {
        console.error('Failed to load from IndexedDB:', err);
        dispatch({ type: 'CLEAR_PROJECT' });
        loadedRef.current = true;
      });
  }, []);

  // Auto-save to IndexedDB (debounced 500ms)
  useEffect(() => {
    if (!loadedRef.current) return; // don't save before first load

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      const doc: ProjectDocument = {
        id: 'current',
        meta: state.meta,
        categories: state.categories,
        assets: state.assets,
        updatedAt: Date.now(),
      };
      saveProject(doc).catch((err) => {
        console.error('Failed to save to IndexedDB:', err);
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [state.meta, state.categories, state.assets]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
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
