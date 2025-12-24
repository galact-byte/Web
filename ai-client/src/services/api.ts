// API service for handling chat requests to different AI providers
import { invoke } from '@tauri-apps/api/core';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ApiSettings {
    provider: string;
    apiKey: string;
    apiUrl: string;
    model: string;
}

export interface ChatResponse {
    content: string;
    error?: string;
}

interface TauriHttpResponse {
    status: number;
    body: string;
}

// Load settings from localStorage
export function getApiSettings(): ApiSettings | null {
    const provider = localStorage.getItem('ai_provider');
    const apiKey = localStorage.getItem('ai_api_key');
    const apiUrl = localStorage.getItem('ai_api_url');
    const model = localStorage.getItem('ai_model');

    if (!apiKey || !apiUrl) {
        return null;
    }

    return {
        provider: provider || 'openai',
        apiKey,
        apiUrl: apiUrl.trim(), // 🔍 添加 trim
        model: model || 'gpt-4o'
    };
}

// Helper function to make HTTP POST request via Tauri
async function tauriPost(url: string, headers: Record<string, string>, body: string): Promise<TauriHttpResponse> {
    try {
        // 🔍 添加详细日志
        console.log('=== Tauri HTTP POST Request ===');
        console.log('URL:', url);
        console.log('URL length:', url.length);
        console.log('Headers:', headers);
        console.log('Body:', body.substring(0, 200) + '...');
        
        // Use Tauri invoke to bypass CORS
        const response = await invoke<TauriHttpResponse>('http_post', {
            url,
            headers,
            body
        });
        
        console.log('=== Response Received ===');
        console.log('Status:', response.status);
        console.log('Body:', response.body.substring(0, 200) + '...');
        
        return response;
    } catch (error: any) {
        console.error('=== Tauri Invoke Error ===');
        console.error(error);
        throw new Error(error.toString());
    }
}

// Send chat request based on provider
export async function sendChatRequest(
    messages: ChatMessage[],
    settings: ApiSettings
): Promise<ChatResponse> {
    try {
        // 🔍 添加日志
        console.log('=== Send Chat Request ===');
        console.log('Provider:', settings.provider);
        console.log('Model:', settings.model);
        console.log('API URL:', settings.apiUrl);
        console.log('Messages:', messages);
        
        switch (settings.provider) {
            case 'anthropic':
                return await sendAnthropicRequest(messages, settings);
            case 'google':
                return await sendGoogleRequest(messages, settings);
            default:
                // OpenAI-compatible API (OpenAI, DeepSeek, OpenRouter, Custom)
                return await sendOpenAIRequest(messages, settings);
        }
    } catch (error: any) {
        console.error('=== Chat Request Error ===');
        console.error(error);
        return {
            content: '',
            error: error.message || 'Unknown error occurred'
        };
    }
}

// OpenAI-compatible API request
async function sendOpenAIRequest(
    messages: ChatMessage[],
    settings: ApiSettings
): Promise<ChatResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
    };

    const body = JSON.stringify({
        model: settings.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false
    });

    const response = await tauriPost(settings.apiUrl, headers, body);

    if (response.status < 200 || response.status >= 300) {
        console.error('=== API Error Response ===');
        console.error('Status:', response.status);
        console.error('Body:', response.body);
        
        const errorData = JSON.parse(response.body || '{}');
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = JSON.parse(response.body);
    return {
        content: data.choices?.[0]?.message?.content || ''
    };
}

// Anthropic Claude API request
async function sendAnthropicRequest(
    messages: ChatMessage[],
    settings: ApiSettings
): Promise<ChatResponse> {
    // Separate system message from other messages
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
    };

    const body = JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        system: systemMessage?.content || 'You are a helpful assistant.',
        messages: chatMessages.map(m => ({ role: m.role, content: m.content }))
    });

    const response = await tauriPost(settings.apiUrl, headers, body);

    if (response.status < 200 || response.status >= 300) {
        const errorData = JSON.parse(response.body || '{}');
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = JSON.parse(response.body);
    return {
        content: data.content?.[0]?.text || ''
    };
}

// Google Gemini API request
async function sendGoogleRequest(
    messages: ChatMessage[],
    settings: ApiSettings
): Promise<ChatResponse> {
    // Build the URL with model name and API key
    const url = settings.apiUrl
        .replace('{model}', settings.model)
        + `?key=${settings.apiKey}`;

    // Convert messages to Gemini format
    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

    // Add system instruction if present
    const systemMessage = messages.find(m => m.role === 'system');

    const requestBody: any = { contents };
    if (systemMessage) {
        requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };

    const response = await tauriPost(url, headers, JSON.stringify(requestBody));

    if (response.status < 200 || response.status >= 300) {
        const errorData = JSON.parse(response.body || '{}');
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
    }

    const data = JSON.parse(response.body);
    return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    };
}