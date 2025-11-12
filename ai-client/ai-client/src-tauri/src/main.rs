#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::thread;
use std::path::PathBuf;
use std::time::Duration;
use std::io::Write;
use std::fs::OpenOptions;

struct AppState {
    backend: Arc<Mutex<Option<Child>>>,
}

// 日志宏
macro_rules! log {
    ($file:expr, $($arg:tt)*) => {
        {
            let msg = format!($($arg)*);
            println!("{}", msg);
            if let Some(ref mut f) = $file {
                let _ = writeln!(f, "{}", msg);
            }
        }
    };
}

fn find_backend_path(app_handle: &tauri::AppHandle, log_file: &mut Option<std::fs::File>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    {
        let paths = vec![
            std::env::current_dir()?.join("backend").join("dist").join("api-server").join("api-server.exe"),
            std::env::current_dir()?.join("backend").join("dist").join("api-server.exe"),
            std::env::current_dir()?.join("src-tauri").join("binaries").join("api-server").join("api-server.exe"),
            std::env::current_dir()?.join("src-tauri").join("binaries").join("api-server.exe"),
        ];
        
        for path in paths {
            log!(log_file, "🔍 检查开发路径: {:?}", path);
            if path.exists() {
                return Ok(path);
            }
        }
    }
    
    #[cfg(not(debug_assertions))]
    {
        let resource_dir = app_handle.path().resource_dir()?;
        log!(log_file, "📂 资源目录: {:?}", resource_dir);
        
        let paths = vec![
            resource_dir.join("binaries").join("api-server").join("api-server.exe"),
            resource_dir.join("binaries").join("api-server.exe"),
            resource_dir.join("api-server").join("api-server.exe"),
            resource_dir.join("api-server.exe"),
        ];
        
        for path in &paths {
            log!(log_file, "🔍 检查路径: {:?}", path);
            if path.exists() {
                log!(log_file, "✅ 找到文件！");
                return Ok(path.clone());
            }
        }
        
        // 列出实际的目录内容
        log!(log_file, "📋 列出 binaries 目录:");
        if let Ok(entries) = std::fs::read_dir(resource_dir.join("binaries")) {
            for entry in entries.flatten() {
                log!(log_file, "  - {:?}", entry.path());
            }
        }
    }
    
    Err("找不到后端可执行文件".into())
}

fn check_backend_alive(child: &mut Child, log_file: &mut Option<std::fs::File>) -> bool {
    match child.try_wait() {
        Ok(None) => true,
        Ok(Some(status)) => {
            log!(log_file, "❌ 后端进程已退出，状态码: {:?}", status);
            false
        }
        Err(e) => {
            log!(log_file, "❌ 检查进程状态失败: {}", e);
            false
        }
    }
}

fn main() {
    // 创建日志文件
    let log_path = std::env::temp_dir().join("ai-client-tauri.log");
    let mut log_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
        .ok();
    
    log!(log_file, "========================================");
    log!(log_file, "AI Client Tauri 启动");
    log!(log_file, "日志位置: {:?}", log_path);
    log!(log_file, "========================================");
    
    tauri::Builder::default()
        .setup(move |app| {
            log!(log_file, "🔍 开始查找后端...");
            
            let backend_path = match find_backend_path(app.handle(), &mut log_file) {
                Ok(path) => {
                    log!(log_file, "✅ 找到后端: {:?}", path);
                    
                    if !path.exists() {
                        log!(log_file, "❌ 文件不存在: {:?}", path);
                        app.manage(AppState {
                            backend: Arc::new(Mutex::new(None)),
                        });
                        return Ok(());
                    }
                    
                    if let Ok(meta) = std::fs::metadata(&path) {
                        log!(log_file, "📏 文件大小: {} bytes", meta.len());
                    }
                    path
                }
                Err(e) => {
                    log!(log_file, "❌ 找不到后端: {}", e);
                    app.manage(AppState {
                        backend: Arc::new(Mutex::new(None)),
                    });
                    return Ok(());
                }
            };

            log!(log_file, "🚀 启动后端: {:?}", backend_path);
            
            let mut cmd = Command::new(&backend_path);
            
            // 设置工作目录
            if let Some(parent) = backend_path.parent() {
                log!(log_file, "📁 工作目录: {:?}", parent);
                cmd.current_dir(parent);
            }
            
            // 显示 CMD 窗口
            cmd.stdout(Stdio::inherit())
               .stderr(Stdio::inherit());
            
            // match cmd.spawn() {
            //     Ok(mut child) => {
            //         let pid = child.id();
            //         log!(log_file, "✅ 后端进程已启动 (PID: {})", pid);
                    
            //         thread::sleep(Duration::from_secs(2));
                    
            //         if check_backend_alive(&mut child, &mut log_file) {
            //             log!(log_file, "✅ 后端进程运行正常");
            //             app.manage(AppState {
            //                 backend: Arc::new(Mutex::new(Some(child))),
            //             });
                        
            //             log!(log_file, "⏳ 等待后端服务启动...");
            //             thread::sleep(Duration::from_secs(3));
            //             log!(log_file, "✅ 等待完成");
            //         } else {
            //             log!(log_file, "❌ 后端进程启动后立即退出");
            //             app.manage(AppState {
            //                 backend: Arc::new(Mutex::new(None)),
            //             });
            //         }
            //     }
            //     Err(e) => {
            //         log!(log_file, "❌ 启动后端失败: {}", e);
            //         app.manage(AppState {
            //             backend: Arc::new(Mutex::new(None)),
            //         });
            //     }
            // }
            // ========= 启动后端（增强版，带日志捕获和健康检查） =========
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader};

log!(log_file, "🚀 启动后端: {:?}", backend_path);

let mut cmd = Command::new(&backend_path);

// 关键：修复工作目录问题（必须切到 binaries 才能找到依赖）
if let Some(parent) = backend_path.parent() {
    log!(log_file, "📁 工作目录: {:?}", parent);
    cmd.current_dir(parent);
}

// 把后端 stdout/stderr 重定向到日志
cmd.stdout(Stdio::piped())
   .stderr(Stdio::piped());

match cmd.spawn() {
    Ok(mut child) => {
        let pid = child.id();
        log!(log_file, "✅ 后端进程已启动 (PID: {})", pid);

        // 异步把输出写入日志
        if let Some(stdout) = child.stdout.take() {
            let mut f_out = OpenOptions::new().append(true).open(&log_path).ok();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().flatten() {
                    if let Some(ref mut f) = f_out {
                        let _ = writeln!(f, "[api stdout] {}", line);
                    }
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let mut f_err = OpenOptions::new().append(true).open(&log_path).ok();
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().flatten() {
                    if let Some(ref mut f) = f_err {
                        let _ = writeln!(f, "[api stderr] {}", line);
                    }
                }
            });
        }

        // 等 2 秒再检测
        thread::sleep(Duration::from_secs(2));

        if check_backend_alive(&mut child, &mut log_file) {
            log!(log_file, "✅ 后端进程仍在运行，开始健康检查...");
            // 保存进程
            app.manage(AppState {
                backend: Arc::new(Mutex::new(Some(child))),
            });

            // 健康检查等待后端端口起来
            let start = std::time::Instant::now();
            loop {
                if start.elapsed() > Duration::from_secs(10) {
                    log!(log_file, "⚠️ 健康检查超时，可能后端未成功启动");
                    break;
                }
                if let Ok(resp) = reqwest::blocking::get("http://127.0.0.1:8000/health") {
                    if resp.status().is_success() {
                        log!(log_file, "✅ 健康检查通过，后端就绪");
                        break;
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
        } else {
            log!(log_file, "❌ 后端进程启动后立即退出（查看上方 [api stderr]）");
            app.manage(AppState {
                backend: Arc::new(Mutex::new(None)),
            });
        }
    }
    Err(e) => {
        log!(log_file, "❌ 启动后端失败: {}", e);
        app.manage(AppState {
            backend: Arc::new(Mutex::new(None)),
        });
    }
}


            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>().backend.clone();
                
                thread::spawn(move || {
                    println!("🛑 正在关闭后端...");
                    if let Ok(mut backend) = state.lock() {
                        if let Some(mut child) = backend.take() {
                            let _ = child.kill();
                            println!("✅ 后端已关闭");
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("❌ Tauri 运行错误");
}