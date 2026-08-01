// 统一的文件保存入口：支持时弹原生保存框让用户选目录（可直存非 C 盘），
// 不支持 / 偏好关闭 / 保存框出错时回退到经典 <a download>。
import { getExportAskLocation, isSaveFilePickerSupported } from './exportPreference';

export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled';

interface SaveFilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

function buildPickerTypes(filename: string): SaveFilePickerType[] {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  const map: Record<string, SaveFilePickerType> = {
    '.zip': { description: 'ZIP 压缩包', accept: { 'application/zip': ['.zip'] } },
    '.evidence': { description: '加密采集包', accept: { 'application/octet-stream': ['.evidence'] } },
    '.docx': {
      description: 'Word 文档',
      accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    },
  };
  return map[ext] ? [map[ext]] : [];
}

function downloadViaAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

type ShowSaveFilePicker = (options: {
  suggestedName?: string;
  types?: SaveFilePickerType[];
}) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;

/**
 * 保存一个 Blob。
 * @param preferPicker 覆盖“导出时询问保存位置”偏好；缺省时读用户偏好。
 * @returns 'saved' 已写入所选位置 / 'downloaded' 走了普通下载 / 'cancelled' 用户取消保存框。
 */
export async function saveBlob(blob: Blob, filename: string, preferPicker?: boolean): Promise<SaveOutcome> {
  const wantPicker = (preferPicker ?? getExportAskLocation()) && isSaveFilePickerSupported();
  if (wantPicker) {
    const showSaveFilePicker = (window as unknown as { showSaveFilePicker: ShowSaveFilePicker }).showSaveFilePicker;
    try {
      const handle = await showSaveFilePicker({ suggestedName: filename, types: buildPickerTypes(filename) });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      // 用户取消：放弃本次导出，不报错、不回退强存。
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') return 'cancelled';
      // 其它异常（权限/写入失败等）：回退普通下载，保证导出不至于彻底失败。
      downloadViaAnchor(blob, filename);
      return 'downloaded';
    }
  }
  downloadViaAnchor(blob, filename);
  return 'downloaded';
}
