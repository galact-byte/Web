import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { prioritizeLanAddresses } from '../utils/lanBridge';
import type { LanAddress, LanBridge, LanCollectorSnapshot } from '../utils/lanBridge';

interface LanCollectorDialogProps {
  open: boolean;
  snapshot: LanCollectorSnapshot;
  bridge: LanBridge | null;
  onClose: () => void;
}

const LanCollectorDialog: React.FC<LanCollectorDialogProps> = ({ open, snapshot, bridge, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<LanAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  useEffect(() => {
    if (!open || !bridge) return;
    void bridge.getStatus().then((status) => {
      const sortedAddresses = prioritizeLanAddresses(status.addresses);
      setUrl(status.url);
      setAddresses(sortedAddresses);
      setSelectedAddress((current) => current && sortedAddresses.some((entry) => entry.address === current) ? current : sortedAddresses[0]?.address ?? '');
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '无法读取会话状态。'));
  }, [bridge, open]);

  useEffect(() => {
    if (!url) { setQrCode(''); return; }
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrCode)
      .catch(() => setMessage('二维码生成失败，请复制链接后在手机浏览器打开。'));
  }, [url]);

  const handleStart = async () => {
    if (!bridge || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const status = await bridge.startSession(snapshot, selectedAddress);
      setUrl(status.url);
      setAddresses(prioritizeLanAddresses(status.addresses));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启动局域网采集失败。');
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async (closeAfterStop = false) => {
    if (!bridge || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await bridge.stopSession();
      setUrl(null);
      if (closeAfterStop) onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '停止局域网采集失败。');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeAddress = (address: string) => {
    setSelectedAddress(address);
    if (url) {
      setUrl(null);
      void bridge?.stopSession();
      setMessage('已切换局域网地址，请重新启动会话并扫描新的二维码。');
    }
  };

  const handleClose = () => {
    if (url) { void handleStop(true); return; }
    onClose();
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="lan-collector-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="w-full max-w-lg border border-slate-300 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4"><div><h2 id="lan-collector-title" className="text-xl font-bold text-slate-950">手机局域网采集</h2><p className="mt-1 text-sm text-slate-600">当前系统的图片将直接同步到电脑中的对应项目。</p></div><button type="button" onClick={handleClose} disabled={busy} className="min-h-11 min-w-11 border border-slate-300 text-lg text-slate-700 hover:bg-slate-100" aria-label="关闭手机局域网采集对话框">×</button></div>
        <div className="mt-5 border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong>使用前确认：</strong>电脑和手机需连接同一 Wi-Fi，或电脑连接手机热点；首次启动如被 Windows 防火墙询问，请仅在“专用网络”允许。此临时 HTTP 链接仅适合受信任的同一局域网，不用于互联网，也不提供离线加密或 PWA 功能。</div>
        {addresses.length > 1 && <label className="mt-5 block text-sm font-medium text-slate-700">电脑连接地址<select value={selectedAddress} disabled={busy || Boolean(url)} onChange={(event) => handleChangeAddress(event.target.value)} className="mt-1 min-h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-100"><option value="">请选择手机可访问的 Wi-Fi / 热点地址</option>{addresses.map((entry) => <option key={entry.address} value={entry.address}>{entry.name} · {entry.address}</option>)}</select></label>}
        {url ? <div className="mt-5 grid gap-4 sm:grid-cols-[240px_1fr]"><div className="border border-slate-200 bg-white p-2">{qrCode ? <img src={qrCode} alt="手机局域网采集链接二维码" width="240" height="240" className="h-auto w-full" /> : <div className="flex aspect-square items-center justify-center text-sm text-slate-500">正在生成二维码...</div>}</div><div className="min-w-0"><p className="text-sm font-semibold text-emerald-700">会话已启动</p><label className="mt-2 block text-sm font-medium text-slate-700">手机访问链接<textarea readOnly value={url} className="mt-1 min-h-24 w-full resize-none border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700" /></label><button type="button" onClick={() => void navigator.clipboard?.writeText(url).then(() => setMessage('链接已复制。')).catch(() => setMessage('无法自动复制，请手动复制链接。'))} className="mt-2 min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">复制链接</button></div></div> : <p className="mt-5 border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">启动后会生成一次性链接和二维码。关闭会话、离开项目列表或关闭电脑程序后，手机链接会立即失效。</p>}
        {message && <p role="status" className="mt-4 border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</p>}
        <div className="mt-6 flex justify-end gap-3">{url ? <button type="button" onClick={() => void handleStop()} disabled={busy} className="min-h-11 border border-red-700 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? '正在停止...' : '停止会话'}</button> : <button type="button" onClick={() => void handleStart()} disabled={busy} className="min-h-11 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">{busy ? '正在启动...' : '启动局域网采集'}</button>}</div>
      </section>
    </div>
  );
};

export default LanCollectorDialog;
