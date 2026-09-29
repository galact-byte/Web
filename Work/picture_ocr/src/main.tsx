import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializePwa } from './utils/pwa';
import { ToastProvider } from './components/Toast';
import { installGlobalErrorHandlers } from './utils/errorLog';
import { installUnloadGuard } from './utils/pendingWrites';
import { requestPersistence } from './utils/storagePersistence';

// 尽早安装全局错误捕获，确保渲染前的异常也能落日志（UI 通知回调由 App 挂载后补上）。
installGlobalErrorHandlers();

// 写入未完成时拦住关闭，避免未提交的 IndexedDB 事务随页面销毁而中止。
installUnloadGuard();

void initializePwa();

// 申请持久存储（浏览器可能静默拒绝，结果在存储设置里如实显示；不反复申请）。
void requestPersistence();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
