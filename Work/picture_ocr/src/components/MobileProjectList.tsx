import React, { useEffect, useState } from 'react';
import type { ProjectSummary } from '../types';
import { createProjectDocument, listProjectGroups, saveProject } from '../utils/db';
import { importEncryptedDataPackage } from '../utils/exportImport';
import PwaReadinessCard from './PwaReadinessCard';

interface MobileProjectListProps {
  onOpen: (projectId: string) => void;
  onOpenDesktop: () => void;
}

const MobileProjectList: React.FC<MobileProjectListProps> = ({ onOpen, onOpenDesktop }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [message, setMessage] = useState('正在加载本机项目...');
  const [importPassword, setImportPassword] = useState('');
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    listProjectGroups().then((groups) => {
      setProjects(groups.flatMap((group) => group.systems));
      setMessage('');
    }).catch((err) => setMessage(`加载项目失败：${err instanceof Error ? err.message : '未知错误'}`));
  }, []);

  const handleInitialize = async (file: File | undefined) => {
    if (!file || initializing) return;
    if (!file.name.toLowerCase().endsWith('.evidence')) return setMessage('初始化仅接受 .evidence 加密采集包。');
    if (!importPassword) return setMessage('请输入初始化加密采集包密码。');
    setInitializing(true);
    try {
      const target = createProjectDocument();
      const result = await importEncryptedDataPackage(file, importPassword, 'overwrite', target.assets, target.categories, target.meta);
      if (!result.success || !result.data) return setMessage(result.message);
      const initialized = { ...target, ...result.data, updatedAt: Date.now() };
      await saveProject(initialized);
      onOpen(initialized.id);
    } catch (err) {
      setMessage(`初始化失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setInitializing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-start justify-between gap-4"><div><h1 className="text-xl font-bold">手机采集</h1><p className="mt-1 text-sm text-slate-500">选择已保存的系统项目后拍照归档。</p></div><button onClick={onOpenDesktop} className="border border-slate-300 bg-white px-3 py-2 text-sm">桌面工作台</button></header>
        <PwaReadinessCard />
        <section className="mb-4 border border-slate-200 bg-white p-4"><h2 className="font-semibold">从加密初始化包新建采集项目</h2><label className="mt-3 block text-sm text-slate-700">密码<input type="password" value={importPassword} onChange={(event) => setImportPassword(event.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2" /></label><label className="mt-3 inline-flex cursor-pointer border border-slate-300 px-3 py-2 text-sm">{initializing ? '正在解密并创建...' : '选择 .evidence 初始化包'}<input type="file" accept=".evidence" disabled={initializing} onChange={(event) => { void handleInitialize(event.target.files?.[0]); event.currentTarget.value = ''; }} className="hidden" /></label></section>
        {message && <p className="mb-4 border border-slate-200 bg-white p-4 text-sm text-slate-600">{message}</p>}
        {projects.length > 0 && <div className="space-y-3">{projects.map((project) => <button key={project.id} onClick={() => onOpen(project.id)} className="w-full border border-slate-200 bg-white p-4 text-left shadow-sm active:bg-blue-50"><span className="block font-semibold">{project.meta.systemName || project.meta.projectName || '未命名系统'}</span><span className="mt-1 block text-sm text-slate-500">{project.meta.unitName || '未填写单位'} · {project.assetCount} 个资产</span></button>)}</div>}
      </div>
    </main>
  );
};

export default MobileProjectList;
