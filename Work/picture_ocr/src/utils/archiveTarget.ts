/**
 * 归档文件保存目标：Web 用 File System Access 目录句柄，桌面用主进程 IPC（渲染进程只持有一次性 targetId）。
 * 约定：write 完成即已落盘且不覆盖同名文件；read 必须重新从磁盘读取，不能返回内存副本，
 * 这样「读回校验通过」才代表磁盘上的文件确实可用。
 */

export interface ArchiveTarget {
  /** 显示名：Web 为目录名，桌面为完整路径。 */
  label: string;
  /** 所选目录与本地数据在同一块盘（归档不能释放该盘空间）；null 表示无法判断（Web）。 */
  sameDriveAsData: boolean | null;
  exists(name: string): Promise<boolean>;
  write(name: string, blob: Blob): Promise<void>;
  read(name: string): Promise<Blob>;
}

type DirectoryPicker = (options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle>;

type ArchiveBridge = Pick<NonNullable<Window['evidenceArchive']>, 'exists' | 'writeFile' | 'readFile'>;

const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/;

function assertSafeName(name: string): string {
  if (!name || name.length > 200 || INVALID_NAME.test(name) || name === '.' || name === '..' || /[. ]$/.test(name)) {
    throw new Error('归档文件名无效。');
  }
  return name;
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError');
}

function getDirectoryPicker(): DirectoryPicker | null {
  const picker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return typeof picker === 'function' ? picker.bind(window) : null;
}

/** 当前环境能否选择归档保存位置（桌面桥，或 Chrome/Edge 的目录选择）。 */
export function isArchiveTargetSupported(): boolean {
  return Boolean(window.evidenceArchive) || getDirectoryPicker() !== null;
}

/** 基于目录句柄的目标（Web）。写入走 createWritable：浏览器先写临时文件，close 时才替换为正式文件。 */
export function createDirectoryHandleTarget(dir: FileSystemDirectoryHandle, label = dir.name): ArchiveTarget {
  const exists = async (name: string) => {
    try {
      await dir.getFileHandle(assertSafeName(name));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  };
  return {
    label,
    sameDriveAsData: null,
    exists,
    async write(name, blob) {
      if (await exists(name)) throw new Error('同名归档文件已存在。');
      const handle = await dir.getFileHandle(assertSafeName(name), { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => undefined);
        // 已创建的空文件会被误认为归档，失败时清掉。
        await dir.removeEntry(name).catch(() => undefined);
        throw error;
      }
    },
    async read(name) {
      const handle = await dir.getFileHandle(assertSafeName(name));
      return handle.getFile();
    },
  };
}

/** 基于桌面 IPC 桥的目标。 */
export function createDesktopTarget(bridge: ArchiveBridge, choice: ArchiveDirectoryChoice): ArchiveTarget {
  return {
    label: choice.label,
    sameDriveAsData: choice.sameDriveAsData,
    exists: (name) => bridge.exists(choice.targetId, assertSafeName(name)),
    async write(name, blob) {
      await bridge.writeFile(choice.targetId, assertSafeName(name), new Uint8Array(await blob.arrayBuffer()));
    },
    async read(name) {
      const bytes = await bridge.readFile(choice.targetId, assertSafeName(name));
      return new Blob([bytes as BlobPart]);
    },
  };
}

/**
 * 让用户选择保存目录。取消返回 null；环境不支持时抛出可展示的错误。
 * Web 端必须在用户点击的事件处理中调用（浏览器要求用户手势）。
 */
export async function chooseArchiveTarget(): Promise<ArchiveTarget | null> {
  const bridge = window.evidenceArchive;
  if (bridge) {
    const choice = await bridge.chooseDirectory();
    return choice ? createDesktopTarget(bridge, choice) : null;
  }
  const picker = getDirectoryPicker();
  if (!picker) throw new Error('当前浏览器不支持选择保存目录，请使用 Chrome 或 Edge 打开。');
  try {
    const dir = await picker({ id: 'evidence-archive', mode: 'readwrite' });
    return createDirectoryHandleTarget(dir);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}
