import React, { useEffect, useMemo, useRef, useState } from 'react';

interface LanMobileCollectorProps {
  token: string;
}

const LanMobileCollector: React.FC<LanMobileCollectorProps> = ({ token }) => {
  const [snapshot, setSnapshot] = useState<LanCollectorSnapshot | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [message, setMessage] = useState('正在验证采集会话...');
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeAsset = useMemo(() => snapshot?.assets.find((asset) => asset.id === activeAssetId) ?? null, [snapshot, activeAssetId]);
  const visibleAssets = useMemo(() => snapshot?.assets.filter((asset) => asset.categoryId === activeCategoryId) ?? [], [snapshot, activeCategoryId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/session?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => ({ message: '会话无效或已结束。' }))).message);
        return response.json() as Promise<LanCollectorSnapshot>;
      })
      .then((nextSnapshot) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        const firstCategoryId = nextSnapshot.categories[0]?.id ?? null;
        setActiveCategoryId(firstCategoryId);
        setActiveAssetId(nextSnapshot.assets.find((asset) => asset.categoryId === firstCategoryId)?.id ?? null);
        setMessage('');
      })
      .catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : '无法连接采集会话。'); });
    return () => { cancelled = true; };
  }, [token]);

  const selectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setActiveAssetId(snapshot?.assets.find((asset) => asset.categoryId === categoryId)?.id ?? null);
  };

  const waitForSaveConfirmation = async (requestId: string): Promise<string> => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const response = await fetch(`/api/upload-status?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({ message: '无法确认电脑端保存状态。' }));
      if (response.status === 202) continue;
      if (!response.ok) throw new Error(result.message || '电脑端未能保存图片。');
      return result.message || '图片已同步到电脑。';
    }
    throw new Error('等待电脑端保存图片超时，请确认工作台仍保持打开。');
  };

  const uploadImage = async (assetId: string, itemId: string, file: File | undefined) => {
    if (!file || uploadingItemId) return;
    if (!file.type.startsWith('image/')) { setMessage('只能上传图片文件。'); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage('图片不能超过 10MB。'); return; }
    setUploadingItemId(itemId);
    setMessage('');
    try {
      const response = await fetch(`/api/upload?token=${encodeURIComponent(token)}&assetId=${encodeURIComponent(assetId)}&itemId=${encodeURIComponent(itemId)}`, {
        method: 'POST',
        headers: { 'content-type': file.type, 'x-file-name': encodeURIComponent(file.name) },
        body: file,
      });
      const result = await response.json().catch(() => ({ message: '上传失败。', requestId: '' }));
      if (response.status === 202 && result.requestId) {
        setMessage('图片已收到，正在写入电脑项目...');
        setMessage(await waitForSaveConfirmation(result.requestId));
      } else if (response.status === 201) {
        setMessage(result.message || '图片已同步到电脑。');
      } else {
        throw new Error(result.message || '上传失败。');
      }
      setSnapshot((current) => current ? {
        ...current,
        assets: current.assets.map((asset) => asset.id !== assetId ? asset : { ...asset, items: asset.items.map((item) => item.id === itemId ? { ...item, imageCount: item.imageCount + 1 } : item) }),
      } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败，请检查电脑端会话是否仍在运行。');
    } finally {
      setUploadingItemId(null);
    }
  };

  if (!snapshot) return <main className="min-h-dvh bg-slate-100 p-5 text-base text-slate-700"><div className="mx-auto max-w-xl border border-slate-200 bg-white p-4" role="status">{message}</div></main>;

  return (
    <main className="min-h-dvh bg-slate-100 pb-8 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="mx-auto max-w-3xl"><h1 className="truncate text-lg font-bold">{snapshot.title}</h1><p className="mt-1 text-sm text-slate-600">局域网实时采集 · 图片会同步到电脑</p></div></header>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {message && <p role="status" className="border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p>}
        <nav aria-label="检查分类" className="flex gap-2 overflow-x-auto pb-1">{snapshot.categories.map((category) => <button key={category.id} type="button" onClick={() => selectCategory(category.id)} className={`min-h-11 shrink-0 border px-3 text-sm font-medium ${category.id === activeCategoryId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{category.name}</button>)}</nav>
        <section aria-label="资产" className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleAssets.map((asset) => <button key={asset.id} type="button" onClick={() => setActiveAssetId(asset.id)} className={`min-h-16 border p-3 text-left text-sm ${asset.id === activeAsset?.id ? 'border-sky-700 bg-sky-50 font-semibold text-sky-950' : 'border-slate-200 bg-white'}`}><span className="block break-words">{asset.name}</span><span className="mt-1 block text-xs font-normal text-slate-600">{asset.items.length} 项</span></button>)}</section>
        {!activeAsset ? <p className="border border-slate-200 bg-white p-4 text-sm text-slate-600">请选择资产。</p> : <section className="space-y-3">{activeAsset.items.length === 0 ? <p className="border border-slate-200 bg-white p-4 text-sm text-slate-600">此资产暂无检查项，请联系电脑端补充。</p> : activeAsset.items.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold leading-6">{item.label}</h2>{item.required && <span className="shrink-0 border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-800">必填</span>}</div><p className="mt-2 text-sm text-slate-600">已同步 {item.imageCount} 张</p><input ref={(node) => { inputRefs.current[item.id] = node; }} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" capture="environment" className="hidden" onChange={(event) => { void uploadImage(activeAsset.id, item.id, event.target.files?.[0]); event.currentTarget.value = ''; }} /><button type="button" onClick={() => inputRefs.current[item.id]?.click()} disabled={uploadingItemId !== null} className="mt-3 min-h-11 w-full border border-sky-700 bg-white px-4 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">{uploadingItemId === item.id ? '正在同步...' : '拍照 / 选择图片'}</button></article>)}</section>}
      </div>
    </main>
  );
};

export default LanMobileCollector;
