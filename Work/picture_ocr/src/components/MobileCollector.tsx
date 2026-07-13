import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Category, ImageData, ProjectDocument } from '../types';
import { importEncryptedDataPackage, exportEncryptedDataPackage } from '../utils/exportImport';
import { isEvidencePackageFile } from '../utils/evidencePackage';
import { readImageFiles } from '../utils/imageFiles';
import { loadProject, saveProject } from '../utils/db';
import EncryptedExportDialog from './EncryptedExportDialog';
import PwaReadinessCard from './PwaReadinessCard';

interface MobileCollectorProps {
  projectId: string;
  onBack: () => void;
}

function projectName(document: ProjectDocument): string {
  return document.meta.systemName.trim() || document.meta.projectName.trim() || '未命名采集项目';
}

const MobileCollector: React.FC<MobileCollectorProps> = ({ projectId, onBack }) => {
  const [document, setDocument] = useState<ProjectDocument | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<ImageData | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const activeAsset = useMemo(() => document?.assets.find((asset) => asset.id === activeAssetId) ?? null, [document, activeAssetId]);
  const visibleAssets = useMemo(() => document?.assets.filter((asset) => asset.categoryId === activeCategoryId) ?? [], [document, activeCategoryId]);

  useEffect(() => {
    loadProject(projectId).then((loaded) => {
      if (!loaded) {
        setMessage('项目不存在或已被删除。');
        return;
      }
      setDocument(loaded);
      setActiveCategoryId(loaded.assets[0]?.categoryId ?? loaded.categories[0]?.id ?? null);
      setActiveAssetId(loaded.assets[0]?.id ?? null);
    }).catch((err) => setMessage(`加载项目失败：${err instanceof Error ? err.message : '未知错误'}`));
  }, [projectId]);

  const persist = async (nextDocument: ProjectDocument) => {
    const next = { ...nextDocument, updatedAt: Date.now() };
    setDocument(next);
    await saveProject(next);
  };

  const handleImages = async (asset: Asset, itemId: string, files: FileList | null) => {
    if (!document || !files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return setMessage('请选择图片文件。');
    try {
      const images = await readImageFiles(imageFiles);
      await persist({
        ...document,
        assets: document.assets.map((candidate) => candidate.id !== asset.id ? candidate : {
          ...candidate,
          items: candidate.items.map((item) => item.id === itemId ? { ...item, images: [...item.images, ...images] } : item),
        }),
      });
      setMessage(`已归档 ${images.length} 张图片。`);
    } catch (err) {
      setMessage(`读取图片失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const removeImage = async (assetId: string, itemId: string, imageId: string) => {
    if (!document || !window.confirm('确定删除这张图片吗？')) return;
    await persist({
      ...document,
      assets: document.assets.map((asset) => asset.id !== assetId ? asset : {
        ...asset,
        items: asset.items.map((item) => item.id !== itemId ? item : { ...item, images: item.images.filter((image) => image.id !== imageId) }),
      }),
    });
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || !document || importing) return;
    if (!isEvidencePackageFile(file)) return setMessage('手机采集端仅接受 .evidence 加密采集包。');
    if (!importPassword) return setMessage('导入加密采集包前请输入密码。');
    setImporting(true);
    try {
      const result = await importEncryptedDataPackage(file, importPassword, 'merge', document.assets, document.categories, document.meta);
      if (!result.success || !result.data) return setMessage(result.message);
      await persist({ ...document, ...result.data });
      setImportPassword('');
      setMessage(result.message);
    } catch (err) {
      setMessage(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleExport = async (password: string) => {
    if (!document) return;
    await exportEncryptedDataPackage(document.meta, document.categories, document.assets, password);
    setMessage('已生成加密采集包。请通过浏览器下载列表保存文件，再用 USB 回传电脑。');
  };

  if (!document) return <main className="min-h-screen bg-slate-100 p-5 text-sm text-slate-600">{message || '正在加载采集项目...'}</main>;

  return (
    <main className="min-h-screen bg-slate-100 pb-8 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><div className="min-w-0"><h1 className="truncate text-lg font-bold">{projectName(document)}</h1><p className="truncate text-xs text-slate-500">手机采集模式</p></div><button onClick={onBack} className="border border-slate-300 px-3 py-2 text-sm">项目列表</button></div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <PwaReadinessCard />
        <section className="border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-2"><button onClick={() => setExportOpen(true)} className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white">导出加密采集包</button><button onClick={() => importInputRef.current?.click()} disabled={importing} className="border border-slate-300 px-4 py-2 text-sm">合并导入采集包</button></div>
          <input ref={importInputRef} type="file" accept=".evidence" onChange={(event) => void handleImportFile(event.target.files?.[0])} className="hidden" />
          <label className="mt-3 block text-sm text-slate-700">加密包导入密码<input type="password" value={importPassword} onChange={(event) => setImportPassword(event.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2" /></label>
          {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
        </section>
        <section className="flex gap-2 overflow-x-auto pb-1">{document.categories.map((category: Category) => <button key={category.id} onClick={() => { setActiveCategoryId(category.id); setActiveAssetId(document.assets.find((asset) => asset.categoryId === category.id)?.id ?? null); }} className={`shrink-0 border px-3 py-2 text-sm ${category.id === activeCategoryId ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white'}`}>{category.name}</button>)}</section>
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleAssets.map((asset) => <button key={asset.id} onClick={() => setActiveAssetId(asset.id)} className={`min-h-16 border p-3 text-left text-sm ${asset.id === activeAsset?.id ? 'border-blue-500 bg-blue-50 font-semibold text-blue-800' : 'border-slate-200 bg-white'}`}>{asset.name}<span className="mt-1 block text-xs text-slate-500">{asset.items.length} 项</span></button>)}</section>
        {activeAsset ? <section className="space-y-3">{activeAsset.items.length === 0 ? <p className="border border-slate-200 bg-white p-5 text-sm text-slate-500">此资产暂无检查项，请在桌面工作台添加后再采集。</p> : activeAsset.items.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{item.label}</h2>{item.required && <span className="shrink-0 border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">必填</span>}</div><div className="mt-3 grid grid-cols-3 gap-2">{item.images.map((image) => <div key={image.id} className="relative aspect-square overflow-hidden border border-slate-200"><button onClick={() => setViewingImage(image)} className="h-full w-full"><img src={image.data} alt={image.fileName} className="h-full w-full object-cover" /></button><button onClick={() => void removeImage(activeAsset.id, item.id, image.id)} className="absolute right-1 top-1 bg-slate-950/70 px-1.5 py-0.5 text-xs text-white">删除</button></div>)}<label className="flex aspect-square cursor-pointer flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 p-2 text-center text-sm text-blue-700"><span>拍照/选图</span><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => { void handleImages(activeAsset, item.id, event.target.files); event.currentTarget.value = ''; }} className="hidden" /></label></div></article>)}</section> : <p className="border border-slate-200 bg-white p-5 text-sm text-slate-500">请选择资产。</p>}
      </div>
      <EncryptedExportDialog open={exportOpen} title="导出手机加密采集包" onClose={() => setExportOpen(false)} onExport={handleExport} />
      {viewingImage && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setViewingImage(null)}><img src={viewingImage.data} alt={viewingImage.fileName} className="max-h-full max-w-full object-contain" /></div>}
    </main>
  );
};

export default MobileCollector;
