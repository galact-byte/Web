import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDirectory = resolve('.verify-evidence');
globalThis.crypto ??= webcrypto;

try {
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc',
    '--target', 'ES2020',
    '--module', 'NodeNext',
    '--moduleResolution', 'NodeNext',
    '--lib', 'ES2020,DOM',
    '--skipLibCheck',
    '--outDir', outputDirectory,
    'src/utils/evidencePackage.ts',
  ], { stdio: 'inherit' });

  const evidencePackage = await import(pathToFileURL(resolve(outputDirectory, 'evidencePackage.js')).href);
  const source = new Blob(['手机离线采集加密回归验证'], { type: 'application/zip' });
  const encrypted = await evidencePackage.encryptEvidenceBlob(source, 'correct-password');
  const encryptedAgain = await evidencePackage.encryptEvidenceBlob(source, 'correct-password');
  const envelope = JSON.parse(await encrypted.text());
  if (await encrypted.text() === await encryptedAgain.text()) {
    throw new Error('重复导出没有使用新的随机 salt/IV。');
  }

  if (evidencePackage.validateEvidenceEnvelope(envelope) !== null) {
    throw new Error('生成的加密信封未通过格式校验。');
  }
  if (evidencePackage.validateEvidenceEnvelope({ ...envelope, version: 999 }) === null) {
    throw new Error('格式校验没有拒绝未知版本。');
  }
  if (evidencePackage.validateEvidenceEnvelope({ ...envelope, kdf: { ...envelope.kdf, iterations: 2_000_000 } }) === null) {
    throw new Error('格式校验没有拒绝非 v1 协议 KDF 参数。');
  }
  if (evidencePackage.validateEvidenceEnvelope({ ...envelope, kdf: { ...envelope.kdf, salt: envelope.kdf.salt.slice(0, -4) } }) === null) {
    throw new Error('格式校验没有拒绝长度错误的 salt。');
  }

  const decrypted = await evidencePackage.decryptEvidenceBlob(encrypted, 'correct-password');
  if (await decrypted.text() !== '手机离线采集加密回归验证') {
    throw new Error('加密往返后的明文不一致。');
  }

  let wrongPasswordRejected = false;
  try {
    await evidencePackage.decryptEvidenceBlob(encrypted, 'wrong-password');
  } catch {
    wrongPasswordRejected = true;
  }
  if (!wrongPasswordRejected) throw new Error('错误密码没有被拒绝。');

  console.log('加密采集包格式、往返解密和错误密码拒绝验证通过。');
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
