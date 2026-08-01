// 导出保存位置偏好：是否在导出时弹原生保存框让用户选目录。
// 仅 Web 有意义；桌面 Electron(file://) 不支持 showSaveFilePicker，自动回退普通下载。

const KEY = 'evidence.exportAskLocation';

/** 当前环境是否支持 File System Access 的保存框（Chromium + 安全上下文）。 */
export function isSaveFilePickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

/** 是否“导出时询问保存位置”。默认：支持保存框时为 true，否则 false。 */
export function getExportAskLocation(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === null) return isSaveFilePickerSupported();
    return stored === '1';
  } catch {
    return false;
  }
}

export function setExportAskLocation(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // localStorage 不可用（隐私模式等）时忽略，退回默认行为。
  }
}
