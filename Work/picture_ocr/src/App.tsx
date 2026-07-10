import React, { useState, useCallback, useEffect } from 'react';
import { AppProvider, useAppState, useDispatch } from './context/AppContext';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import ProjectInfoDialog from './components/ProjectInfoDialog';
import ValidationDialog from './components/ValidationDialog';
import TemplateDialog from './components/TemplateDialog';
import ProjectList from './components/ProjectList';
import { exportWordReport, validateRequired } from './utils/wordExport';
import type { CheckItemTemplate } from './types';
import type { ValidationMissing } from './utils/wordExport';

interface AppContentProps {
  onBackToProjects: () => void;
  openProjectInfoOnMount: boolean;
}

const AppContent: React.FC<AppContentProps> = ({ onBackToProjects, openProjectInfoOnMount }) => {
  const { loaded, meta, categories, assets } = useAppState();
  const dispatch = useDispatch();
  const [projectInfoOpen, setProjectInfoOpen] = useState(openProjectInfoOnMount);
  const [validationMissing, setValidationMissing] = useState<ValidationMissing[]>([]);
  const [validationOpen, setValidationOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  useEffect(() => {
    if (openProjectInfoOnMount) {
      setProjectInfoOpen(true);
    }
  }, [openProjectInfoOnMount]);

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

const App: React.FC = () => {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [newProjectInfoPrompt, setNewProjectInfoPrompt] = useState(false);
  const [projectListRefreshKey, setProjectListRefreshKey] = useState(0);

  const handleOpenProject = (projectId: string, isNewProject = false) => {
    setNewProjectInfoPrompt(isNewProject);
    setOpenProjectId(projectId);
  };

  const handleBackToProjects = () => {
    setOpenProjectId(null);
    setNewProjectInfoPrompt(false);
    setProjectListRefreshKey((key) => key + 1);
  };

  const handleProjectSaved = useCallback(() => {
    setProjectListRefreshKey((key) => key + 1);
  }, []);

  if (!openProjectId) {
    return <ProjectList key={projectListRefreshKey} onOpenProject={handleOpenProject} />;
  }

  return (
    <AppProvider
      key={openProjectId}
      projectId={openProjectId}
      onProjectSaved={handleProjectSaved}
    >
      <AppContent
        onBackToProjects={handleBackToProjects}
        openProjectInfoOnMount={newProjectInfoPrompt}
      />
    </AppProvider>
  );
};

export default App;
