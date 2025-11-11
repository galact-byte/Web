#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, Mutex};
use std::thread;

struct AppState {
    backend: Arc<Mutex<Option<Child>>>,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 找后端路径（你之前的逻辑不变）
            let resource_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("src-tauri/resources"));
            let backend_path = resource_dir.join("binaries").join("api-server.exe");
            println!("🚀 启动后端: {:?}", backend_path);

            let child = Command::new(&backend_path)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("❌ 启动后端失败");

            app.manage(AppState {
                backend: Arc::new(Mutex::new(Some(child))),
            });

            std::thread::sleep(std::time::Duration::from_secs(2));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 阻止默认立即关闭，等后台任务执行
                api.prevent_close();

                let state = window.state::<AppState>().backend.clone();
                // 在新线程里安全关闭后端
                thread::spawn(move || {
                    if let Ok(mut backend) = state.lock() {
                        if let Some(mut child) = backend.take() {
                            let _ = child.kill();
                            println!("🛑 后端已关闭");
                        }
                    }
                    // 关闭窗口（必须放在子线程里）
                    window.close().ok();
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("❌ Tauri 运行错误");
}
