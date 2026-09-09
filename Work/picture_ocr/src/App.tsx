import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppProvider, useAppContext, useAppState, useDispatch } from './context/AppContext';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import ProjectInfoDialog from './components/ProjectInfoDialog';
import ValidationDialog from './components/ValidationDialog';
import TemplateDialog from './components/TemplateDialog';
import ProjectList from './components/ProjectList';
import MobileProjectList from './components/MobileProjectList';
import MobileCollector from './components/MobileCollector';
import LanMobileCollector from './components/LanMobileCollector';
import LanCollectorDialog from './components/LanCollectorDialog';
import { exportWordReport, validateRequired } from './utils/wordExport';
import type { CheckItemTemplate } from './types';
import type { ValidationMissing } from './utils/wordExport';
import { detectLanBridge } from './utils/lanBridge';
import { buildGroupSnapshot } from './utils/lanGroupSnapshot';
import { saveLanImageToProject } from './utils/lanImageSink';
import { useToast } from './components/Toast';
import { recordError, setErrorNotifier } from './utils/errorLog';
import type { LanBridge, LanCollectorSnapshot, LanCollectorSystem } from './utils/lanBridge';
import type { LanImageSavePayload } from './utils/lanImageSink';

/** 当前打开系统上报给 App 层 LAN 管理器的绑定：实时结构 + 该系统的落库入口。 */
export interface OpenSystemBinding {
  projectId: string;
  groupId: string | null;
  liveSystem: LanCollectorSystem;
  saveImage: (payload: LanImageSavePayload) => Promise<void>;
}

interface AppContentProps {
  projectId: string;
  onBackToProjects: () => void;
  openProjectInfoOnMount: boolean;
  lanEnabled: boolean;
  lanSessionRunning: boolean;
  onOpenLanCollector: () => void;
  onRegisterLanBinding: (binding: OpenSystemBinding | null) => void;
}

const AppContent: React.FC<AppContentProps> = ({
  projectId,
  onBackToProjects,
  openProjectInfoOnMount,
  lanEnabled,
  lanSessionRunning,
  onOpenLanCollector,
  onRegisterLanBinding,
}) => {
  const { loaded, meta, categories, assets } = useAppState();
  const { addImageAndSave, projectGroupId } = useAppContext();
  const dispatch = useDispatch();
  const showToast = useToast();
  const [projectInfoOpen, setProjectInfoOpen] = useState(openProjectInfoOnMount);
  const [validationMissing, setValidationMissing] = useState<ValidationMissing[]>([]);
  const [validationOpen, setValidationOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // 当前系统的实时结构快照（仅结构与张数，喂给 App 层组快照的“当前打开系统”覆盖）。
  const liveSystem = useMemo<LanCollectorSystem>(() => ({
    projectId,
    title: meta.systemName.trim() || meta.projectName.trim() || '未命名采集系统',
    categories: categories.map((category) => ({ id: category.id, name: category.name })),
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      categoryId: asset.categoryId,
      items: asset.items.map((item) => ({ id: item.id, label: item.label, required: item.required, imageCount: item.images.length })),
    })),
  }), [assets, categories, meta.projectName, meta.systemName, projectId]);

  useEffect(() => {
    if (openProjectInfoOnMount) setProjectInfoOpen(true);
  }, [openProjectInfoOnMount]);

  // 向 App 层上报/撤销当前打开系统的绑定；App 层据此分流落库并保持组快照最新。
  useEffect(() => {
    if (!loaded) return;
    onRegisterLanBinding({ projectId, groupId: projectGroupId, liveSystem, saveImage: addImageAndSave });
    return () => onRegisterLanBinding(null);
  }, [loaded, projectId, projectGroupId, liveSystem, addImageAndSave, onRegisterLanBinding]);

  // Word export
  const handleExportWord = useCallback(async () => {
    const missing = validateRequired(categories, assets);
    if (missing.length > 0) {
      setValidationMissing(missing);
      setValidationOpen(true);
    } else {
      try {
        await exportWordReport(meta, categories, assets);
      } catch (err) {
        showToast(`导出失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
      }
    }
  }, [meta, categories, assets, showToast]);

  const handleSaveTemplates = useCallback(
    (categoryId: string, items: CheckItemTemplate[]) => {
      dispatch({ type: 'SET_TEMPLATES', payload: { categoryId, items } });
    },
    [dispatch]
  );

  const handleContinueExport = useCallback(async () => {
    setValidationOpen(false);
    try {
      await exportWordReport(meta, categories, assets);
    } catch (err) {
      showToast(`导出失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  }, [meta, categories, assets, showToast]);

  if (!loaded) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          onBackToProjects={onBackToProjects}
          onOpenProjectInfo={() => setProjectInfoOpen(true)}
          onExportWord={handleExportWord}
          onManageTemplates={() => setTemplateDialogOpen(true)}
          onOpenLanCollector={lanEnabled ? onOpenLanCollector : undefined}
          lanSessionRunning={lanSessionRunning}
        />
        <ContentArea />
      </div>
      <ProjectInfoDialog
        open={projectInfoOpen}
        onClose={() => setProjectInfoOpen(false)}
      />
      <TemplateDialog
        isOpen={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        categories={categories}
        onSaveTemplates={handleSaveTemplates}
      />
      <ValidationDialog
        isOpen={validationOpen}
        missing={validationMissing}
        onContinue={handleContinueExport}
        onCancel={() => setValidationOpen(false)}
      />
    </div>
  );
};

function getMobileProjectId(): string | null {
  const match = window.location.hash.match(/^#\/mobile\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getLanToken(): string | null {
  const match = window.location.hash.match(/^#\/lan\/([A-Za-z0-9_-]+)$/);
  return match ? match[1] : null;
}

function getDesktopProjectId(): string | null {
  const match = window.location.hash.match(/^#\/project\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]) || null;
  } catch {
    return null;
  }
}

/**
 * App 层局域网组会话管理器：会话归属项目组、跨系统切换不中断；
 * onImage 按目标系统分流落库（当前打开系统走内存 sink 实时刷新，其余系统直写 db）。
 */
function useLanGroupSession(bridge: LanBridge | null) {
  const [running, setRunning] = useState(false);
  const [snapshot, setSnapshot] = useState<LanCollectorSnapshot | null>(null);
  const [notice, setNotice] = useState('');
  const bindingRef = useRef<OpenSystemBinding | null>(null);
  const activeGroupRef = useRef<{ groupId: string | null; groupTitle: string; systemIds?: string[] | null } | null>(null);
  const runningRef = useRef(false);
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { runningRef.current = running; }, [running]);

  const rebuildNow = useCallback(async () => {
    const group = activeGroupRef.current;
    if (!group) return;
    try {
      const next = await buildGroupSnapshot({
        groupId: group.groupId,
        groupTitle: group.groupTitle,
        systemIds: group.systemIds ?? null,
        openSystemOverride: bindingRef.current?.liveSystem ?? null,
      });
      setSnapshot(next);
      if (runningRef.current && bridge) {
        const status = await bridge.updateSession(next);
        setRunning(status.running);
        if (!status.running) setNotice('手机局域网采集会话已结束。');
      }
    } catch (error) {
      setNotice(`同步项目结构失败：${error instanceof Error ? error.message : '未知错误'}。`);
    }
  }, [bridge]);

  const scheduleRebuild = useCallback(() => {
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    rebuildTimerRef.current = setTimeout(() => { void rebuildNow(); }, 400);
  }, [rebuildNow]);

  const registerBinding = useCallback((binding: OpenSystemBinding | null) => {
    bindingRef.current = binding;
    // 未开会话时若尚无活动组，跟随当前打开系统的组，便于工作台内直接启动。
    if (!activeGroupRef.current && binding) {
      activeGroupRef.current = { groupId: binding.groupId, groupTitle: '' };
    }
    scheduleRebuild();
  }, [scheduleRebuild]);

  // onImage 分流：目标是当前打开系统 → 走内存 sink（UI 实时刷新）；否则直写 db。
  useEffect(() => {
    if (!bridge) return;
    return bridge.onImage((upload) => {
      const payload: LanImageSavePayload = {
        assetId: upload.assetId,
        itemId: upload.itemId,
        image: { id: `lan-${upload.requestId}`, fileName: upload.image.fileName, data: upload.image.data, caption: '', uploadedAt: new Date().toISOString() },
      };
      const binding = bindingRef.current;
      const save = binding && binding.projectId === upload.projectId
        ? binding.saveImage
        : (input: LanImageSavePayload) => saveLanImageToProject(upload.projectId, input);
      void save(payload).then(
        () => { bridge.confirmImageSaved(upload.requestId, { success: true }); scheduleRebuild(); },
        (error: unknown) => {
          // 手机端会看到失败提示，但电脑端也必须留下痕迹，否则这张图为什么没入库无从查起。
          recordError({
            type: 'manual',
            message: `手机上传图片写入失败（系统 ${upload.projectId}）：${error instanceof Error ? error.message : String(error)}`,
            stack: error instanceof Error ? error.stack : undefined,
            context: 'lan:saveImage',
          });
          bridge.confirmImageSaved(upload.requestId, { success: false, message: error instanceof Error ? error.message : '电脑端未能保存图片。' });
        }
      );
    });
  }, [bridge, scheduleRebuild]);

  const prepareForGroup = useCallback((group: { groupId: string | null; groupTitle: string; systemIds?: string[] | null }) => {
    activeGroupRef.current = group;
    void rebuildNow();
  }, [rebuildNow]);

  const handleStatusChange = useCallback((isRunning: boolean) => {
    setRunning(isRunning);
    if (isRunning) setNotice('');
  }, []);

  useEffect(() => () => {
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    void bridge?.stopSession();
  }, [bridge]);

  return { running, snapshot, notice, registerBinding, prepareForGroup, handleStatusChange };
}

const App: React.FC = () => {
  const showToast = useToast();
  const [hash, setHash] = useState(() => window.location.hash);

  // 将未捕获错误（全局 error / unhandledrejection）以 Toast 提示，避免静默假死。
  useEffect(() => {
    setErrorNotifier((message) => showToast(`发生错误：${message}`, 'error'));
  }, [showToast]);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [newProjectInfoPrompt, setNewProjectInfoPrompt] = useState(false);
  const [projectListRefreshKey, setProjectListRefreshKey] = useState(0);
  const [lanBridge, setLanBridge] = useState<LanBridge | null>(null);
  const [lanDialogOpen, setLanDialogOpen] = useState(false);

  const lan = useLanGroupSession(lanBridge);

  useEffect(() => {
    void detectLanBridge().then(setLanBridge);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
      if (!getDesktopProjectId()) {
        setOpenProjectId(null);
        setNewProjectInfoPrompt(false);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenProject = (projectId: string, isNewProject = false) => {
    setNewProjectInfoPrompt(isNewProject);
    setOpenProjectId(projectId);
    window.location.hash = `/project/${encodeURIComponent(projectId)}`;
  };

  const handleBackToProjects = () => {
    setOpenProjectId(null);
    setNewProjectInfoPrompt(false);
    setProjectListRefreshKey((key) => key + 1);
    window.location.hash = '';
  };

  const handleProjectSaved = useCallback(() => {
    setProjectListRefreshKey((key) => key + 1);
  }, []);

  const handleLeaveMobile = () => {
    setOpenProjectId(null);
    setNewProjectInfoPrompt(false);
    setProjectListRefreshKey((key) => key + 1);
    window.location.hash = '';
  };

  const openLanFromWorkbench = useCallback(() => {
    setLanDialogOpen(true);
  }, []);

  const { prepareForGroup } = lan;
  const startLanForGroup = useCallback((groupId: string | null, groupTitle: string, systemIds: string[]) => {
    prepareForGroup({ groupId, groupTitle, systemIds });
    setLanDialogOpen(true);
  }, [prepareForGroup]);

  const mobileProjectId = getMobileProjectId();
  const lanToken = getLanToken();
  if (lanToken) return <LanMobileCollector token={lanToken} />;
  if (hash === '#/mobile') {
    return <MobileProjectList onOpen={(projectId) => { window.location.hash = `/mobile/${encodeURIComponent(projectId)}`; }} onOpenDesktop={handleLeaveMobile} />;
  }
  if (mobileProjectId) {
    return <MobileCollector projectId={mobileProjectId} onBack={() => { window.location.hash = '#/mobile'; }} />;
  }

  const desktopProjectId = getDesktopProjectId();
  const activeProjectId = desktopProjectId ?? openProjectId;

  const lanDialog = lanBridge ? (
    <LanCollectorDialog
      open={lanDialogOpen}
      snapshot={lan.snapshot}
      bridge={lanBridge}
      sessionNotice={lan.notice}
      onClose={() => setLanDialogOpen(false)}
      onSessionStatusChange={lan.handleStatusChange}
    />
  ) : null;

  if (!activeProjectId) {
    return (
      <>
        <ProjectList key={projectListRefreshKey} onOpenProject={handleOpenProject} onStartLanCollector={lanBridge ? startLanForGroup : undefined} />
        {lanDialog}
      </>
    );
  }

  return (
    <>
      <AppProvider
        key={activeProjectId}
        projectId={activeProjectId}
        onProjectSaved={handleProjectSaved}
      >
        <AppContent
          projectId={activeProjectId}
          onBackToProjects={handleBackToProjects}
          openProjectInfoOnMount={newProjectInfoPrompt}
          lanEnabled={Boolean(lanBridge)}
          lanSessionRunning={lan.running}
          onOpenLanCollector={openLanFromWorkbench}
          onRegisterLanBinding={lan.registerBinding}
        />
      </AppProvider>
      {lanDialog}
    </>
  );
};

export default App;
