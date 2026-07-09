import React, { useState, useCallback } from 'react';
import { AppProvider, useAppState, useDispatch } from './context/AppContext';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import ProjectInfoDialog from './components/ProjectInfoDialog';
import ImportDialog from './components/ImportDialog';
import ValidationDialog from './components/ValidationDialog';
import TemplateDialog from './components/TemplateDialog';
import { exportDataPackage, importDataPackage } from './utils/exportImport';
import { exportWordReport, validateRequired } from './utils/wordExport';
import type { ProjectDocument, CheckItemTemplate } from './types';
import type { ValidationMissing } from './utils/wordExport';

const AppContent: React.FC = () => {
  const { loaded, meta, categories, assets } = useAppState();
  const dispatch = useDispatch();
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [validationMissing, setValidationMissing] = useState<ValidationMissing[]>([]);
  const [validationOpen, setValidationOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Export data
  const handleExportData = useCallback(async () => {
    try {
      await exportDataPackage(meta, categories, assets);
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, [meta, categories, assets]);

  // Import overwrite
  const handleImportOverwrite = useCallback(
    async (file: File) => {
      const result = await importDataPackage(file, 'overwrite', assets, categories, meta);
      if (!result.success || !result.data) {
        alert(result.message);
        return;
      }
      const doc: ProjectDocument = {
        id: 'current',
        meta: result.data.meta,
        categories: result.data.categories,
        assets: result.data.assets,
        updatedAt: Date.now(),
      };
      dispatch({ type: 'LOAD_PROJECT', payload: doc });
      alert(result.message);
    },
    [assets, categories, meta, dispatch]
  );

  // Import merge
  const handleImportMerge = useCallback(
    async (file: File) => {
      const result = await importDataPackage(file, 'merge', assets, categories, meta);
      if (!result.success || !result.data) {
        alert(result.message);
        return;
      }
      const doc: ProjectDocument = {
        id: 'current',
        meta: result.data.meta,
        categories: result.data.categories,
        assets: result.data.assets,
        updatedAt: Date.now(),
      };
      dispatch({ type: 'LOAD_PROJECT', payload: doc });
      alert(result.message);
    },
    [assets, categories, meta, dispatch]
  );

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
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar
        onOpenProjectInfo={() => setProjectInfoOpen(true)}
        onExportData={handleExportData}
        onImportData={() => setImportDialogOpen(true)}
        onExportWord={handleExportWord}
        onManageTemplates={() => setTemplateDialogOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ContentArea />
      </div>
      <ProjectInfoDialog
        open={projectInfoOpen}
        onClose={() => setProjectInfoOpen(false)}
      />
      <ImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportOverwrite={handleImportOverwrite}
        onImportMerge={handleImportMerge}
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
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
