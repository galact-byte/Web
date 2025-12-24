use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

// Tauri command to make HTTP POST requests (bypasses CORS)
#[tauri::command]
async fn http_post(
    url: String,
    headers: HashMap<String, String>,
    body: String,
) -> Result<HttpResponse, String> {
    let url = url.trim();
    println!("Backend: http_post called for URL: '{}'", url);
    
    let client = reqwest::Client::new();
    let mut request = client.post(url);

    let mut has_ua = false;
    // Add headers
    for (key, value) in headers {
        if key.to_lowercase() == "user-agent" {
            has_ua = true;
        }
        request = request.header(&key, &value);
    }

    // Ensure User-Agent is present
    if !has_ua {
        request = request.header(reqwest::header::USER_AGENT, "ai-client/1.0");
    }

    // Send request with body
    let response = request
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    let response_body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    println!("Backend: Response Status: {}", status);

    Ok(HttpResponse { status, body: response_body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![http_post])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}