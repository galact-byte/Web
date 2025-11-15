#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] // 关键：隐藏控制台

use tauri::Manager;
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::thread;
use std::path::PathBuf;
use std::time::Duration;

struct AppState {
    backend: Arc<Mutex<Option<Child>>>,
}

/// 查找后端可执行文件
fn find_backend_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    {
        // 开发模式：搜索多个可能的位置
        let paths = vec![
            std::env::current_dir()?.join("backend").join("dist").join("api-server").join("api-server.exe"),
            std::env::current_dir()?.join("backend").join("dist").join("api-server.exe"),
            std::env::current_dir()?.join("src-tauri").join("binaries").join("api-server").join("api-server.exe"),
        ];
        
        for path in paths {
            if path.exists() {
                return Ok(path);
            }
        }
    }
    
    #[cfg(not(debug_assertions))]
    {
        // 生产模式：从资源目录查找
        let resource_dir = app_handle.path().resource_dir()?;
        let paths = vec![
            resource_dir.join("binaries").join("api-server").join("api-server.exe"),
            resource_dir.join("binaries").join("api-server.exe"),
        ];
        
        for path in &paths {
            if path.exists() {
                return Ok(path.clone());
            }
        }
    }
    
    Err("找不到后端可执行文件".into())
}

/// 检查后端进程是否存活
fn check_backend_alive(child: &mut Child) -> bool {
    match child.try_wait() {
        Ok(None) => true,  // 仍在运行
        Ok(Some(_)) => false,  // 已退出
        Err(_) => false,  // 检查失败
    }
}

/// 等待后端服务就绪
fn wait_for_backend_ready(timeout_secs: u64) -> bool {
    let start = std::time::Instant::now();
    
    while start.elapsed() < Duration::from_secs(timeout_secs) {
        if let Ok(resp) = reqwest::blocking::get("http://127.0.0.1:8000/health") {
            if resp.status().is_success() {
                return true;
            }
        }
        thread::sleep(Duration::from_millis(500));
    }
    
    false
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 查找后端可执行文件
            let backend_path = match find_backend_path(app.handle()) {
                Ok(path) => path,
                Err(_) => {
                    // 找不到后端，仍然启动前端（让用户看到错误信息）
                    app.manage(AppState {
                        backend: Arc::new(Mutex::new(None)),
                    });
                    return Ok(());
                }
            };

            // 启动后端进程
            let mut cmd = Command::new(&backend_path);
            
            // 设置工作目录
            if let Some(parent) = backend_path.parent() {
                cmd.current_dir(parent);
            }
            
            // 关键：完全隐藏后端窗口
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            
            // 重定向输出到null（不显示任何内容）
            cmd.stdout(Stdio::null())
               .stderr(Stdio::null());

            match cmd.spawn() {
                Ok(mut child) => {
                    // 等待2秒检查进程是否正常启动
                    thread::sleep(Duration::from_secs(2));
                    
                    if check_backend_alive(&mut child) {
                        // 保存进程句柄
                        app.manage(AppState {
                            backend: Arc::new(Mutex::new(Some(child))),
                        });
                        
                        // 等待后端服务就绪（最多10秒）
                        thread::spawn(|| {
                            if wait_for_backend_ready(10) {
                                println!("✅ 后端服务已就绪");
                            } else {
                                println!("⚠️ 后端服务启动超时");
                            }
                        });
                    } else {
                        // 进程立即退出
                        app.manage(AppState {
                            backend: Arc::new(Mutex::new(None)),
                        });
                    }
                }
                Err(_) => {
                    // 启动失败
                    app.manage(AppState {
                        backend: Arc::new(Mutex::new(None)),
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // 窗口关闭时，终止后端进程
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>().backend.clone();
                
                thread::spawn(move || {
                    if let Ok(mut backend) = state.lock() {
                        if let Some(mut child) = backend.take() {
                            let _ = child.kill();
                            println!("✅ 后端进程已终止");
                        }
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("Tauri 运行错误");
}