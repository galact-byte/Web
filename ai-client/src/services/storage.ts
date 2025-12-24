// Conversation storage service

export interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
}

const STORAGE_KEY = 'ai_conversations';
const CURRENT_CONV_KEY = 'ai_current_conversation';

// Get all conversations
export function getConversations(): Conversation[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Save all conversations
export function saveConversations(conversations: Conversation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

// Get current conversation ID
export function getCurrentConversationId(): string | null {
    return localStorage.getItem(CURRENT_CONV_KEY);
}

// Set current conversation ID
export function setCurrentConversationId(id: string | null): void {
    if (id) {
        localStorage.setItem(CURRENT_CONV_KEY, id);
    } else {
        localStorage.removeItem(CURRENT_CONV_KEY);
    }
}

// Create a new conversation
export function createConversation(): Conversation {
    const id = `conv_${Date.now()}`;
    const conversation: Conversation = {
        id,
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    const conversations = getConversations();
    conversations.unshift(conversation);
    saveConversations(conversations);
    setCurrentConversationId(id);

    return conversation;
}

// Get conversation by ID
export function getConversation(id: string): Conversation | null {
    const conversations = getConversations();
    return conversations.find(c => c.id === id) || null;
}

// Update conversation
export function updateConversation(id: string, updates: Partial<Conversation>): void {
    const conversations = getConversations();
    const index = conversations.findIndex(c => c.id === id);
    if (index !== -1) {
        conversations[index] = { ...conversations[index], ...updates, updatedAt: Date.now() };
        saveConversations(conversations);
    }
}

// Add message to conversation
export function addMessageToConversation(conversationId: string, message: Message): void {
    const conversations = getConversations();
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
        conv.messages.push(message);
        conv.updatedAt = Date.now();

        // Update title based on first user message
        if (conv.messages.filter(m => m.role === 'user').length === 1 && message.role === 'user') {
            conv.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
        }

        saveConversations(conversations);
    }
}

// Delete conversation
export function deleteConversation(id: string): void {
    const conversations = getConversations().filter(c => c.id !== id);
    saveConversations(conversations);

    if (getCurrentConversationId() === id) {
        setCurrentConversationId(null);
    }
}

// Get or create current conversation
export function getOrCreateCurrentConversation(): Conversation {
    const currentId = getCurrentConversationId();
    if (currentId) {
        const conv = getConversation(currentId);
        if (conv) return conv;
    }
    return createConversation();
}
