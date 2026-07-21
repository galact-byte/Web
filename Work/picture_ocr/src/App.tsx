import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import type { LanBridge, LanCollectorSnapshot } from './utils/lanBridge';

interface AppContentProps {
  projectId: string;
  onBackToProjects: () => void;
  openProjectInfoOnMount: boolean;
  lanBridge: LanBridge | null;
}

const AppContent: React.FC<AppContentProps> = ({ projectId, onBackToProjects, openProjectInfoOnMount, lanBridge }) => {
  const { loaded, meta, categories, assets } = useAppState();
  const { addImageAndSave } = useAppContext();
  const dispatch = useDispatch();
  const [projectInfoOpen, setProjectInfoOpen] = useState(openProjectInfoOnMount);
  const [validationMissing, setValidationMissing] = useState<ValidationMissing[]>([]);
  const [validationOpen, setValidationOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [lanCollectorOpen, setLanCollectorOpen] = useState(false);
  const [lanSessionRunning, setLanSessionRunning] = useState(false);
  const [lanSessionNotice, setLanSessionNotice] = useState('');

  const lanSnapshot = useMemo<LanCollectorSnapshot>(() => ({
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

  useEffect(() => {
    if (!loaded || !lanBridge || !lanSessionRunning) return;
    void lanBridge.updateSession(lanSnapshot).then((status) => {
      setLanSessionRunning(status.running);
      if (!status.running) setLanSessionNotice('手机局域网采集会话已结束。');
    }).catch((error: unknown) => {
      setLanSessionNotice(`手机端同步最新项目结构失败：${error instanceof Error ? error.message : '未知错误'}。`);
    });
  }, [lanBridge, lanSessionRunning, lanSnapshot, loaded]);

  const handleLanSessionStatusChange = useCallback((running: boolean) => {
    setLanSessionRunning(running);
    if (running) setLanSessionNotice('');
  }, []);

  useEffect(() => {
    if (!lanBridge) return;
    return lanBridge.onImage((upload) => {
      if (upload.projectId !== projectId) {
        lanBridge.confirmImageSaved(upload.requestId, { success: false, message: '当前工作台已切换项目，采集会话已结束。' });
        return;
      }
      void addImageAndSave({
        assetId: upload.assetId,
        itemId: upload.itemId,
        image: { id: `lan-${upload.requestId}`, fileName: upload.image.fileName, data: upload.image.data, caption: '', uploadedAt: new Date().toISOString() },
      }).then(
        () => lanBridge.confirmImageSaved(upload.requestId, { success: true }),
        (error: unknown) => lanBridge.confirmImageSaved(upload.requestId, { success: false, message: error instanceof Error ? error.message : '电脑端未能保存图片。' })
      );
    });
  }, [addImageAndSave, lanBridge, projectId]);

  useEffect(() => () => { void lanBridge?.stopSession(); }, [lanBridge]);

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
        alert(`导出失败：${err instanceof Error ? err.message : '未知错误'}`);
      }
    }
  }, [meta, categories, assets]);

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
      alert(`导出失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [meta, categories, assets]);

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
          onOpenLanCollector={lanBridge ? () => setLanCollectorOpen(true) : undefined}
          lanSessionRunning={lanSessionRunning}
        />
        <ContentArea />
      </div>
      <LanCollectorDialog
        open={lanCollectorOpen}
        snapshot={lanSnapshot}
        bridge={lanBridge}
        sessionNotice={lanSessionNotice}
        onClose={() => setLanCollectorOpen(false)}
        onSessionStatusChange={handleLanSessionStatusChange}
      />
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

const App: React.FC = () => {
  const [hash, setHash] = useState(() => window.location.hash);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [newProjectInfoPrompt, setNewProjectInfoPrompt] = useState(false);
  const [projectListRefreshKey, setProjectListRefreshKey] = useState(0);
  const [lanBridge, setLanBridge] = useState<LanBridge | null>(null);

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
  if (!activeProjectId) {
    return <ProjectList key={projectListRefreshKey} onOpenProject={handleOpenProject} />;
  }

  return (
    <AppProvider
      key={activeProjectId}
      projectId={activeProjectId}
      onProjectSaved={handleProjectSaved}
    >
      <AppContent
        projectId={activeProjectId}
        onBackToProjects={handleBackToProjects}
        openProjectInfoOnMount={newProjectInfoPrompt}
        lanBridge={lanBridge}
      />
    </AppProvider>
  );
};

export default App;
