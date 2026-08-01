# 加密采集包规范

## 场景：离线手机采集包

### 1. Scope / Trigger

当浏览器端导出或导入需要通过 USB 在电脑与 iOS、Android、HarmonyOS / HarmonyOS NEXT 浏览器之间流转的采集数据时，使用 `.evidence` 加密包。该功能跨越 UI、文件边界、Web Crypto、ZIP 导入解析和 IndexedDB 保存，必须保持无后端、无网络请求，并且失败时不得回退为明文。

### 2. Signatures

```ts
export async function encryptEvidenceBlob(source: Blob, password: string): Promise<Blob>;
export async function decryptEvidenceBlob(source: Blob, password: string): Promise<Blob>;
export function validateEvidenceEnvelope(value: unknown): string | null;

export async function exportEncryptedDataPackage(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[],
  password: string
): Promise<void>;

export async function importEncryptedDataPackage(
  file: File,
  password: string,
  mode: 'overwrite' | 'merge',
  existingAssets: Asset[],
  existingCategories: Category[],
  existingMeta: ProjectMeta
): Promise<ImportResult>;
```

`src/utils/evidencePackage.ts` 是加密信封和 Web Crypto 的唯一所有者；`src/utils/exportImport.ts` 只负责把现有 ZIP 数据包包装/解包后复用既有导入合并逻辑。组件不得自行派生密钥、解析信封或实现另一套 ZIP 合并。

### 3. Contracts

`.evidence` 文件是 UTF-8 JSON 信封，不是明文 ZIP：

```ts
{
  type: 'picture-ocr.evidence',
  version: 1,
  algorithm: 'AES-GCM',
  kdf: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 310000,
    salt: '<base64, random 16 bytes>'
  },
  iv: '<base64, random 12 bytes>',
  ciphertext: '<base64 AES-256-GCM ciphertext>'
}
```

- 密码仅用于本次导出/导入；不得写入信封、IndexedDB、URL、日志或项目元数据。
- 每次导出必须用 `crypto.getRandomValues` 生成新的 salt 和 IV。
- `.evidence` 解密成功后得到 ZIP Blob，并调用 `importDataPackage` 以沿用覆盖/合并和图片去重语义。
- 桌面导入继续兼容 `.zip` 和 `.evidence`；手机初始化及手机补充导入只接受 `.evidence`。
- 手机拍照使用 `<input type="file" accept="image/*" capture="environment">`，不依赖 `getUserMedia`。不要按 UA 将 HarmonyOS / HarmonyOS NEXT 归类为 Android。

### 4. Validation & Error Matrix

| 条件 | 处理 |
| --- | --- |
| `crypto.subtle` 或 `getRandomValues` 不可用 | 中文提示 Web Crypto 不可用；停止操作，不导出明文 |
| 导出密码为空 | 中文提示输入密码；不生成文件 |
| 两次导出密码不一致 | 中文提示密码不一致；不生成文件 |
| JSON 无法解析、类型/版本/算法/KDF 参数不合法 | 中文提示文件无效或不支持；不触发 ZIP 导入 |
| salt、IV、密文 Base64 或长度无效 | 中文提示编码无效；不触发 ZIP 导入 |
| 密码错误或 GCM 认证失败 | 统一提示“密码不正确或文件已损坏”；不泄露二者区别 |
| 解密后 ZIP/manifest 无效 | 保留既有 `importDataPackage` 的中文错误；不保存目标项目 |

### 5. Good / Base / Bad Cases

- Good：用户用 HTTPS 或 localhost 打开目标浏览器，导出两次同一项目得到不同信封；正确密码可恢复完全相同的 ZIP 内容。
- Base：桌面导入旧 `.zip` 时不要求密码，仍遵循原覆盖/合并逻辑。
- Bad：将加密失败捕获后调用 `exportDataPackage` 下载 ZIP；或将密码添加进 manifest / `ProjectMeta`。这两种行为都禁止。

### 6. Tests Required

项目没有测试框架时，运行 `npm run verify:evidence-package`：

1. 断言生成的信封通过 `validateEvidenceEnvelope`。
2. 断言两次相同输入的密文不同，以验证随机 salt/IV。
3. 断言正确密码可往返恢复明文。
4. 断言错误密码被拒绝。
5. 断言未知版本被格式校验拒绝。

每次修改相关 UI 或工具后，还应运行 `npm run build`、`git diff --check`，并按 README 在目标移动浏览器完成实际拍照、USB 回传和合并导入手工验证。

### 7. Wrong vs Correct

#### Wrong

```ts
try {
  return await encryptEvidenceBlob(zip, password);
} catch {
  return zip; // 加密失败后导出明文，破坏安全承诺
}
```

#### Correct

```ts
const encryptedPackage = await encryptEvidenceBlob(zip, password);
downloadBlob(encryptedPackage, '测评采集包.evidence');
```

错误必须传递到 UI 显示中文提示；调用方不能在任何分支把加密请求降级为 ZIP。
