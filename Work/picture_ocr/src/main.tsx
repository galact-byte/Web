import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializePwa } from './utils/pwa';
import { ToastProvider } from './components/Toast';
import { installGlobalErrorHandlers } from './utils/errorLog';

// 尽早安装全局错误捕获，确保渲染前的异常也能落日志（UI 通知回调由 App 挂载后补上）。
installGlobalErrorHandlers();

void initializePwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
