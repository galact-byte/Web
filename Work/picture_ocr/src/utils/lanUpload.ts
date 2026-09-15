import { compressImageBlob } from './imageCompression';
import { isRecord, requestJson, withDeadline } from './asyncDeadline';
import type { LanCollectorSnapshot } from './lanBridge';

export type UploadPhase = 'processing' | 'uploading' | 'waiting' | 'unconfirmed' | 'failed' | 'expired';
export interface PendingUpload {
  requestId: string;
  token: string;
  projectId: string;
  assetId: string;
  itemId: string;
  targetLabel: string;
  original: File;
  blob?: Blob;
  fileName?: string;
  recovery: boolean;
  sent: boolean;
  serverRequestId?: string;
}
export class UploadError extends Error {
  constructor(message: string, readonly phase: UploadPhase) { super(message); }
}
export function createUploadId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isLanSnapshot(value: unknown): value is LanCollectorSnapshot {
  return isRecord(value) && (value.groupId === null || typeof value.groupId === 'string')
    && (value.uploadRecovery === undefined || typeof value.uploadRecovery === 'number')
    && typeof value.groupTitle === 'string' && Array.isArray(value.systems)
    && value.systems.every(system => isRecord(system) && typeof system.projectId === 'string' && typeof system.title === 'string'
      && Array.isArray(system.categories) && system.categories.every(category => isRecord(category) && typeof category.id === 'string' && typeof category.name === 'string')
      && Array.isArray(system.assets) && system.assets.every(asset => isRecord(asset) && typeof asset.id === 'string' && typeof asset.name === 'string' && typeof asset.categoryId === 'string'
        && Array.isArray(asset.items) && asset.items.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string'
          && typeof item.required === 'boolean' && typeof item.imageCount === 'number' && Number.isFinite(item.imageCount) && item.imageCount >= 0)));
}
export function decodeLanSnapshot(value: unknown): LanCollectorSnapshot {
  if (!isLanSnapshot(value)) throw new Error('采集会话返回的项目结构无效。');
  return value;
}

function message(data: Record<string, unknown>): string {
  return typeof data.message === 'string' ? data.message : '无法确认电脑端保存结果。';
}
function readState(response: Response, data: Record<string, unknown>): 'saved' | 'pending' | 'not_received' | 'failed' {
  if (response.status === 401) throw new UploadError('原采集会话已结束，请先保存原图。', 'expired');
  if (response.status === 201 && (data.state === undefined || data.state === 'saved')) return 'saved';
  if (response.status === 202 && (data.state === undefined || data.state === 'pending')) return 'pending';
  if (response.status === 404 && data.state === 'not_received') return 'not_received';
  if (data.state === 'failed') return 'failed';
  throw new UploadError(message(data), [400, 403, 409, 413, 415, 429].includes(response.status) ? 'failed' : 'unconfirmed');
}
function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 400);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

/** 重试始终核对原身份，只有明确未接收或明确保存失败才重发字节。 */
export async function synchronizeUpload(job: PendingUpload, phase: (value: UploadPhase) => void, signal: AbortSignal): Promise<void> {
  const query = new URLSearchParams({ token: job.token, requestId: job.serverRequestId ?? job.requestId });
  const status = async (parent = signal) => {
    const { response, data } = await requestJson(`/api/upload-status?${query}`, { cache: 'no-store' }, 8000, parent);
    return readState(response, data);
  };
  let retry = false;
  let state: 'saved' | 'pending' | 'not_received' | 'failed' = 'not_received';
  if (job.sent) {
    phase('waiting');
    if (!job.recovery && !job.serverRequestId) throw new UploadError('当前电脑服务不支持安全重试。请先在电脑核对图片并保存原图，再重启同版本应用。', 'unconfirmed');
    state = await status();
    if (state === 'saved') return;
    if (!job.recovery && state !== 'pending') throw new UploadError('当前电脑服务不支持安全重试，请先在电脑核对并保存原图。', 'unconfirmed');
    retry = state === 'failed';
  }
  if (state === 'not_received' || retry) {
    if (!job.original.type.startsWith('image/') || job.original.size > 10 * 1024 * 1024) throw new UploadError('请选择不超过 10MB 的图片。当前原文件仍可保存。', 'failed');
    if (!job.blob) {
      phase('processing');
      const compressed = await compressImageBlob(job.original, undefined, signal);
      if (signal.aborted) throw signal.reason;
      job.blob = compressed.blob;
      job.fileName = compressed.changed ? `${job.original.name.replace(/\.[^.]+$/, '')}.jpg` : job.original.name;
    }
    if (!job.original.type.startsWith('image/') || job.blob.size > 10 * 1024 * 1024) throw new UploadError('图片格式无效或超过 10MB，请先保存原图并在相册处理后重新选择。', 'failed');
    phase('uploading');
    const target = new URLSearchParams({ token: job.token, projectId: job.projectId, assetId: job.assetId, itemId: job.itemId });
    if (job.recovery) { target.set('requestId', job.requestId); if (retry) target.set('retry', '1'); }
    job.sent = true;
    const { response, data } = await requestJson(`/api/upload?${target}`, {
      method: 'POST', headers: { 'content-type': job.blob.type || job.original.type, 'x-file-name': encodeURIComponent(job.fileName ?? job.original.name) }, body: job.blob,
    }, 45000, signal);
    if (typeof data.requestId === 'string') {
      if (job.recovery && data.requestId !== job.requestId) throw new UploadError('电脑返回的上传编号不一致，请保留原图并核对。', 'unconfirmed');
      job.serverRequestId = data.requestId; query.set('requestId', data.requestId);
    }
    state = readState(response, data);
    if (state === 'saved') return;
    if (state === 'failed') throw new UploadError(message(data), 'failed');
  }
  phase('waiting');
  await withDeadline(async waitingSignal => {
    while (true) {
      await pause(waitingSignal);
      const next = await status(waitingSignal);
      if (next === 'saved') return;
      if (next === 'failed') throw new UploadError('电脑端未能保存图片，请检查电脑提示后重试。', 'failed');
      if (next === 'not_received') throw new UploadError('电脑端尚未接收此图片，可重新核对后重试。', 'unconfirmed');
    }
  }, 30000, signal);
}
