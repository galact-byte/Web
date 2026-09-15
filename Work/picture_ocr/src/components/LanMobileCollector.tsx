import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_COMPRESS_OPTIONS } from '../utils/imageCompression';
import { requestJson, withDeadline } from '../utils/asyncDeadline';
import { createUploadId, decodeLanSnapshot, synchronizeUpload, UploadError, type PendingUpload, type UploadPhase } from '../utils/lanUpload';
import { useConfirmDialog } from './ConfirmDialog';

interface LanMobileCollectorProps {
  token: string;
}

type CaptureSourceMode = 'system' | 'separate';
type CaptureTarget = { projectId: string; token: string; assetId: string; itemId: string };

interface ResolvedSelection {
  systemId: string | null;
  categoryId: string | null;
  assetId: string | null;
}

const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp,image/bmp';
const CAPTURE_SOURCE_MODE_KEY = 'lan-capture-source-mode';

function getCaptureSourceMode(): CaptureSourceMode {
  return window.localStorage.getItem(CAPTURE_SOURCE_MODE_KEY) === 'separate' ? 'separate' : 'system';
}

/** 由组快照与上一次选择解析出稳定的“系统 → 分类 → 资产”选择，尽量保持已选、缺失才回退首项。 */
function resolveSelection(
  snapshot: LanCollectorSnapshot,
  prevSystemId: string | null,
  prevCategoryId: string | null,
  prevAssetId: string | null
): ResolvedSelection {
  const system = snapshot.systems.find((entry) => entry.projectId === prevSystemId) ?? snapshot.systems[0] ?? null;
  if (!system) return { systemId: null, categoryId: null, assetId: null };
  const categoryId = system.categories.some((category) => category.id === prevCategoryId)
    ? prevCategoryId
    : system.categories[0]?.id ?? null;
  const assetId = system.assets.some((asset) => asset.id === prevAssetId && asset.categoryId === categoryId)
    ? prevAssetId
    : system.assets.find((asset) => asset.categoryId === categoryId)?.id ?? null;
  return { systemId: system.projectId, categoryId, assetId };
}

const LanMobileCollector: React.FC<LanMobileCollectorProps> = ({ token }) => {
  const [snapshot, setSnapshot] = useState<LanCollectorSnapshot | null>(null);
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [message, setMessage] = useState('正在验证采集会话...');
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('processing');
  const [originalUrl, setOriginalUrl] = useState('');
  const pendingRef = useRef<PendingUpload | null>(null);
  const operationRef = useRef<AbortController | null>(null);
  const fileTargetRef = useRef<CaptureTarget | null>(null);
  const cameraEncodingRef = useRef<AbortController | null>(null);
  const [cameraEncoding, setCameraEncoding] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  const [captureSourceMode, setCaptureSourceMode] = useState<CaptureSourceMode>(getCaptureSourceMode);
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
  const [cameraTarget, setCameraTarget] = useState<CaptureTarget | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFallbackAvailable, setCameraFallbackAvailable] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const galleryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const snapshotRef = useRef<LanCollectorSnapshot | null>(null);
  const activeSystemIdRef = useRef<string | null>(null);
  const activeCategoryIdRef = useRef<string | null>(null);
  const activeAssetIdRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<symbol | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const activeSystem = useMemo(() => snapshot?.systems.find((system) => system.projectId === activeSystemId) ?? null, [snapshot, activeSystemId]);
  const activeAsset = useMemo(() => activeSystem?.assets.find((asset) => asset.id === activeAssetId) ?? null, [activeSystem, activeAssetId]);
  const visibleAssets = useMemo(() => activeSystem?.assets.filter((asset) => asset.categoryId === activeCategoryId) ?? [], [activeSystem, activeCategoryId]);

  const applySelection = useCallback((selection: ResolvedSelection) => {
    activeSystemIdRef.current = selection.systemId;
    activeCategoryIdRef.current = selection.categoryId;
    activeAssetIdRef.current = selection.assetId;
    setActiveSystemId(selection.systemId);
    setActiveCategoryId(selection.categoryId);
    setActiveAssetId(selection.assetId);
  }, []);

  const stopCameraStream = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
  }, []);

  const refreshSnapshot = useCallback(async (initialLoad: boolean, signal?: AbortSignal) => {
    if (refreshInFlightRef.current || signal?.aborted) return;
    const refreshId = Symbol();
    refreshInFlightRef.current = refreshId;
    try {
      const { response, data } = await requestJson(`/api/session?token=${encodeURIComponent(token)}`, { cache: 'no-store' }, 8000, signal);
      if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : '会话无效或已结束。');
      const nextSnapshot = decodeLanSnapshot(data);
      if (signal?.aborted || tokenRef.current !== token) return;
      const previousSystemId = activeSystemIdRef.current;
      const selection = resolveSelection(nextSnapshot, previousSystemId, activeCategoryIdRef.current, activeAssetIdRef.current);
      const selectionChanged = !initialLoad && (
        selection.systemId !== previousSystemId
        || selection.categoryId !== activeCategoryIdRef.current
        || selection.assetId !== activeAssetIdRef.current
      );

      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
      applySelection(selection);
      if (initialLoad) setMessage('');
      else if (selectionChanged) setMessage('电脑端项目结构已更新，当前选择已调整。');
    } catch (error) {
      if (!signal?.aborted && tokenRef.current === token && !snapshotRef.current) setMessage(error instanceof Error ? error.message : '无法连接采集会话。');
    } finally {
      if (refreshInFlightRef.current === refreshId) refreshInFlightRef.current = null;
    }
  }, [applySelection, token]);

  useEffect(() => {
    operationRef.current?.abort();
    operationRef.current = null;
    cameraEncodingRef.current?.abort();
    setUploadingItemId(null);
    setCameraTarget(null);
    setCaptureTarget(null);
    if (pendingRef.current && pendingRef.current.token !== token) setPhase('expired');
    return () => { operationRef.current?.abort(); cameraEncodingRef.current?.abort(); };
  }, [token]);

  useEffect(() => {
    if (!pending) { setOriginalUrl(''); return; }
    const url = URL.createObjectURL(pending.original);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  useEffect(() => {
    snapshotRef.current = null;
    refreshInFlightRef.current = null;
    applySelection({ systemId: null, categoryId: null, assetId: null });
    setSnapshot(null);
    setMessage('正在验证采集会话...');
    const controller = new AbortController();
    void refreshSnapshot(true, controller.signal);
    const timer = window.setInterval(() => void refreshSnapshot(false, controller.signal), 2000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [refreshSnapshot, applySelection]);

  useEffect(() => {
    if (!cameraTarget) return;
    let active = true;
    let stream: MediaStream | null = null;
    setCameraReady(false);

    const openCamera = async () => {
      try {
        const nextStream = await navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!nextStream) throw new Error('当前浏览器不支持网页相机。');
        if (!active) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = nextStream;
        cameraStreamRef.current = nextStream;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = nextStream;
      } catch {
        if (!active) return;
        setCameraTarget(null);
        setCameraFallbackAvailable(true);
        setCaptureTarget(cameraTarget);
        setMessage('网页相机无法启动。可使用系统相机回退，或从相册选择图片。');
      }
    };

    void openCamera();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (cameraStreamRef.current === stream) cameraStreamRef.current = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    };
  }, [cameraTarget]);

  useEffect(() => () => stopCameraStream(), [stopCameraStream]);

  const selectSystem = (systemId: string) => {
    const system = snapshotRef.current?.systems.find((entry) => entry.projectId === systemId) ?? null;
    const categoryId = system?.categories[0]?.id ?? null;
    const assetId = system?.assets.find((asset) => asset.categoryId === categoryId)?.id ?? null;
    applySelection({ systemId, categoryId, assetId });
  };

  const selectCategory = (categoryId: string) => {
    const system = snapshotRef.current?.systems.find((entry) => entry.projectId === activeSystemIdRef.current) ?? null;
    const assetId = system?.assets.find((asset) => asset.categoryId === categoryId)?.id ?? null;
    applySelection({ systemId: activeSystemIdRef.current, categoryId, assetId });
  };

  const selectAsset = (assetId: string) => {
    activeAssetIdRef.current = assetId;
    setActiveAssetId(assetId);
  };

  const runUpload = async (job: PendingUpload) => {
    if (operationRef.current || job !== pendingRef.current) return;
    if (job.token !== token) { setPhase('expired'); return; }
    const controller = new AbortController();
    operationRef.current = controller;
    setUploadingItemId(job.itemId);
    setMessage('');
    try {
      await synchronizeUpload(job, next => { if (!controller.signal.aborted) setPhase(next); }, controller.signal);
      if (controller.signal.aborted || job !== pendingRef.current) return;
      pendingRef.current = null;
      setPending(null);
      setMessage('图片已同步到电脑。');
      void refreshSnapshot(false, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || job !== pendingRef.current) return;
      setPhase(error instanceof UploadError ? error.phase : job.sent ? 'unconfirmed' : 'failed');
      setMessage(error instanceof Error ? error.message : '暂时无法确认保存结果，请重新核对。');
    } finally {
      if (operationRef.current === controller) { operationRef.current = null; setUploadingItemId(null); }
    }
  };

  const uploadImage = async (systemId: string, assetId: string, itemId: string, file: File | undefined) => {
    if (!file || pendingRef.current) return;
    const target = fileTargetRef.current ?? { projectId: systemId, assetId, itemId, token };
    fileTargetRef.current = null;
    const system = snapshotRef.current?.systems.find(system => system.projectId === target.projectId);
    const asset = system?.assets.find(asset => asset.id === target.assetId);
    const item = asset?.items.find(item => item.id === target.itemId);
    const job: PendingUpload = {
      ...target, requestId: createUploadId(), original: file, sent: false,
      recovery: snapshotRef.current?.uploadRecovery === 1,
      targetLabel: `${system?.title ?? '原系统'} / ${asset?.name ?? '原资产'} / ${item?.label ?? '原检查项'}`,
    };
    pendingRef.current = job;
    setPending(job);
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setPhase('failed');
      setMessage('请选择不超过 10MB 的图片。当前原文件仍可保存。');
      return;
    }
    await runUpload(job);
  };

  const closeCameraPreview = () => {
    cameraEncodingRef.current?.abort();
    setCameraEncoding(false);
    stopCameraStream();
    setCameraReady(false);
    setCameraTarget(null);
  };

  const setSourceMode = (mode: CaptureSourceMode) => {
    window.localStorage.setItem(CAPTURE_SOURCE_MODE_KEY, mode);
    setCaptureSourceMode(mode);
    setCaptureTarget(null);
    setCameraFallbackAvailable(false);
    closeCameraPreview();
  };

  const openImagePicker = (assetId: string, itemId: string) => {
    if (pendingRef.current || !activeSystemIdRef.current) return;
    const target = { projectId: activeSystemIdRef.current, token, assetId, itemId };
    fileTargetRef.current = target;
    if (captureSourceMode === 'system') {
      inputRefs.current[itemId]?.click();
      return;
    }
    setCameraFallbackAvailable(false);
    setCaptureTarget(target);
  };

  const startWebCamera = () => {
    if (!captureTarget || uploadingItemId) return;
    const target = captureTarget;
    setCaptureTarget(null);
    setCameraFallbackAvailable(false);
    setCameraTarget(target);
  };

  const chooseGallery = () => {
    const target = captureTarget;
    if (!target || uploadingItemId) return;
    setCaptureTarget(null);
    galleryInputRefs.current[target.itemId]?.click();
  };

  const useCameraInputFallback = () => {
    const target = captureTarget;
    if (!target || uploadingItemId) return;
    setCaptureTarget(null);
    setCameraFallbackAvailable(false);
    cameraInputRefs.current[target.itemId]?.click();
  };

  const captureCameraFrame = () => {
    const target = cameraTarget;
    const systemId = activeSystemIdRef.current;
    const video = cameraVideoRef.current;
    if (!target || !systemId || !video || !cameraReady || uploadingItemId) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setMessage('相机预览尚未就绪，请稍后再试。');
      return;
    }
    // 先保留本次画面的完整像素，上传再共用压缩入口；失败后可保存这份原图。
    const size = { width, height };
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      setMessage('当前浏览器无法处理相机画面，请改用从相册选择。');
      return;
    }
    context.drawImage(video, 0, 0, size.width, size.height);
    const controller = new AbortController();
    cameraEncodingRef.current = controller;
    setCameraEncoding(true);
    void withDeadline(() => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', DEFAULT_COMPRESS_OPTIONS.quality)), 15000, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      if (!blob) throw new Error('拍照失败，请重试或从相册选择。');
      const file = new File([blob], `mobile-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      fileTargetRef.current = target;
      closeCameraPreview();
      void uploadImage(target.projectId, target.assetId, target.itemId, file);
    }).catch(error => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '拍照失败，请重试。');
    }).finally(() => { if (cameraEncodingRef.current === controller) { cameraEncodingRef.current = null; setCameraEncoding(false); } });
  };

  const phaseLabel: Record<UploadPhase, string> = { processing: '正在处理图片…', uploading: '正在上传图片…', waiting: '正在等待电脑保存…', unconfirmed: '尚未确认保存结果', failed: '本次同步未完成', expired: '原采集会话已结束' };
  const recoveryPanel = pending && <section aria-labelledby="upload-recovery-title" className="border border-slate-300 bg-white p-4">
    <h2 id="upload-recovery-title" role="status" className="text-base font-semibold">{phaseLabel[phase]}</h2>
    <p className="mt-2 break-words text-sm text-slate-700">原目标：{pending.targetLabel}</p>
    <p className="mt-2 text-sm leading-6 text-slate-600">照片仅保留在当前页面，刷新、关闭或浏览器回收后无法恢复。离开前请保存原图。尚未确认不代表电脑没有保存。</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={uploadingItemId !== null || phase === 'expired'} onClick={() => void runUpload(pending)} className="min-h-11 border border-sky-700 bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50">重新核对并重试</button>
      <a href={originalUrl || undefined} download={pending.original.name} className="inline-flex min-h-11 items-center border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">保存原图</a>
      <button type="button" disabled={uploadingItemId !== null} className="min-h-11 border border-slate-300 px-3 text-sm text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" onClick={() => {
        const job = pending;
        void confirm({ title: '放弃当前待处理照片？', message: '这不会取消电脑端可能已开始的保存。请先保存原图；放弃后本页无法再核对此照片。', confirmText: '放弃当前照片' }).then(ok => {
          if (ok && pendingRef.current === job) { pendingRef.current = null; setPending(null); setMessage('已放弃本页待处理照片，电脑端可能仍在保存。'); }
        });
      }}>放弃当前照片</button>
    </div>
  </section>;

  if (!snapshot) return <main className="min-h-dvh bg-slate-100 p-5 text-base text-slate-700"><div className="mx-auto max-w-xl space-y-4"><div className="border border-slate-200 bg-white p-4" role="status">{message}</div>{recoveryPanel}</div>{dialog}</main>;

  const multiSystem = snapshot.systems.length > 1;

  return (
    <main className="min-h-dvh bg-slate-100 pb-8 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="mx-auto max-w-3xl"><h1 className="truncate text-lg font-bold">{snapshot.groupTitle}</h1><p className="mt-1 text-sm text-slate-600">局域网实时采集 · 图片会同步到电脑{activeSystem ? ` · 当前系统：${activeSystem.title}` : ''}</p></div></header>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {message && <p role="status" className="border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p>}
        {recoveryPanel}
        {snapshot.systems.length === 0 ? <p className="border border-slate-200 bg-white p-4 text-sm text-slate-600">电脑端项目组暂无系统，请先在电脑端创建系统。</p> : <>
        {multiSystem && <section aria-labelledby="system-picker-title" className="border border-slate-200 bg-white p-3"><h2 id="system-picker-title" className="text-sm font-semibold text-slate-800">采集系统</h2><nav aria-label="选择系统" className="mt-2 flex gap-2 overflow-x-auto pb-1">{snapshot.systems.map((system) => <button key={system.projectId} type="button" onClick={() => selectSystem(system.projectId)} aria-pressed={system.projectId === activeSystemId} className={`min-h-11 shrink-0 border px-3 text-sm font-medium ${system.projectId === activeSystemId ? 'border-sky-700 bg-sky-50 font-semibold text-sky-950' : 'border-slate-300 bg-white text-slate-700'}`}>{system.title}</button>)}</nav></section>}
        <section aria-labelledby="capture-source-mode-title" className="border border-slate-200 bg-white p-3"><h2 id="capture-source-mode-title" className="text-sm font-semibold text-slate-800">图片来源方式</h2><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setSourceMode('system')} aria-pressed={captureSourceMode === 'system'} className={`min-h-11 border px-3 text-left text-sm ${captureSourceMode === 'system' ? 'border-sky-700 bg-sky-50 font-semibold text-sky-950' : 'border-slate-300 bg-white text-slate-700'}`}>系统选择（推荐）<span className="mt-1 block text-xs font-normal text-slate-600">适合微信、华为和雨云等会自行提供拍照或选图的浏览器。</span></button><button type="button" onClick={() => setSourceMode('separate')} aria-pressed={captureSourceMode === 'separate'} className={`min-h-11 border px-3 text-left text-sm ${captureSourceMode === 'separate' ? 'border-sky-700 bg-sky-50 font-semibold text-sky-950' : 'border-slate-300 bg-white text-slate-700'}`}>拍照/相册分开选择<span className="mt-1 block text-xs font-normal text-slate-600">拍照优先尝试网页相机，适合 Chrome 等需要明确选择的浏览器。</span></button></div></section>
        <nav aria-label="检查分类" className="flex gap-2 overflow-x-auto pb-1">{(activeSystem?.categories ?? []).map((category) => <button key={category.id} type="button" onClick={() => selectCategory(category.id)} className={`min-h-11 shrink-0 border px-3 text-sm font-medium ${category.id === activeCategoryId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{category.name}</button>)}</nav>
        <section aria-label="资产" className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleAssets.map((asset) => <button key={asset.id} type="button" onClick={() => selectAsset(asset.id)} className={`min-h-16 border p-3 text-left text-sm ${asset.id === activeAsset?.id ? 'border-sky-700 bg-sky-50 font-semibold text-sky-950' : 'border-slate-200 bg-white'}`}><span className="block break-words">{asset.name}</span><span className="mt-1 block text-xs font-normal text-slate-600">{asset.items.length} 项</span></button>)}</section>
        {(!activeAsset || !activeSystem) ? <p className="border border-slate-200 bg-white p-4 text-sm text-slate-600">请选择资产。</p> : <section className="space-y-3">{activeAsset.items.length === 0 ? <p className="border border-slate-200 bg-white p-4 text-sm text-slate-600">此资产暂无检查项，请联系电脑端补充。</p> : activeAsset.items.map((item) => <article key={item.id} className="border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><h2 className="text-base font-semibold leading-6">{item.label}</h2>{item.required && <span className="shrink-0 border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-800">必填</span>}</div><p className="mt-2 text-sm text-slate-600">已同步 {item.imageCount} 张</p><input ref={(node) => { inputRefs.current[item.id] = node; }} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(event) => { void uploadImage(activeSystem.projectId, activeAsset.id, item.id, event.target.files?.[0]); event.currentTarget.value = ''; }} /><input ref={(node) => { cameraInputRefs.current[item.id] = node; }} type="file" accept={ACCEPTED_IMAGE_TYPES} capture="environment" className="hidden" onChange={(event) => { void uploadImage(activeSystem.projectId, activeAsset.id, item.id, event.target.files?.[0]); event.currentTarget.value = ''; }} /><input ref={(node) => { galleryInputRefs.current[item.id] = node; }} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(event) => { void uploadImage(activeSystem.projectId, activeAsset.id, item.id, event.target.files?.[0]); event.currentTarget.value = ''; }} /><button type="button" onClick={() => openImagePicker(activeAsset.id, item.id)} disabled={pending !== null} className="mt-3 min-h-11 w-full border border-sky-700 bg-white px-4 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50">{uploadingItemId === item.id ? '正在同步...' : '拍照 / 选择图片'}</button>{captureSourceMode === 'system' && <p className="mt-2 text-xs leading-5 text-slate-500">若未出现拍照选项，请切换“拍照/相册分开选择”；vivo 自带浏览器仍可能只提供相册。</p>}</article>)}</section>}
        </>}
      </div>
      {captureSourceMode === 'separate' && captureTarget && <div className="fixed inset-0 z-20 flex items-end bg-slate-950/50 p-4 sm:items-center sm:justify-center"><section role="dialog" aria-modal="true" aria-labelledby="capture-source-title" className="w-full max-w-sm border border-slate-300 bg-white p-4 shadow-lg"><h2 id="capture-source-title" className="text-base font-semibold text-slate-950">选择图片来源</h2><p className="mt-1 text-sm text-slate-600">{cameraFallbackAvailable ? '网页相机不可用，可使用系统相机回退或从相册选择。' : '拍照会优先尝试网页相机；从相册选择不受相机权限影响。'}</p><div className="mt-4 grid gap-2">{cameraFallbackAvailable ? <button type="button" onClick={useCameraInputFallback} disabled={uploadingItemId !== null} className="min-h-11 border border-sky-700 bg-white px-4 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50">使用系统相机回退</button> : <button type="button" onClick={startWebCamera} disabled={uploadingItemId !== null} className="min-h-11 border border-sky-700 bg-white px-4 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50">拍照</button>}<button type="button" onClick={chooseGallery} disabled={uploadingItemId !== null} className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">从相册选择</button><button type="button" onClick={() => { setCaptureTarget(null); setCameraFallbackAvailable(false); }} disabled={uploadingItemId !== null} className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">取消</button></div></section></div>}
      {cameraTarget && <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4"><section role="dialog" aria-modal="true" aria-labelledby="camera-preview-title" className="w-full max-w-lg border border-slate-300 bg-white p-4 shadow-lg"><h2 id="camera-preview-title" className="text-base font-semibold text-slate-950">相机预览</h2><p className="mt-1 text-sm text-slate-600">确认画面后点击“确认拍照”。</p><video ref={cameraVideoRef} autoPlay muted playsInline onLoadedMetadata={(event) => { void event.currentTarget.play().then(() => setCameraReady(true)).catch(() => setMessage('相机预览无法播放，请改用系统相机或从相册选择。')); }} className="mt-4 aspect-[4/3] w-full bg-slate-950 object-cover" /><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={captureCameraFrame} disabled={!cameraReady || cameraEncoding || uploadingItemId !== null} className="min-h-11 border border-sky-700 bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">确认拍照</button><button type="button" onClick={closeCameraPreview} disabled={uploadingItemId !== null} className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">取消</button></div></section></div>}
      {dialog}
    </main>
  );
};

export default LanMobileCollector;
