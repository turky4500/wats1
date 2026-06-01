interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
}
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'reaction';
type MessageDirection = 'incoming' | 'outgoing';
type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
interface Message {
    id: string;
    profileId: string;
    conversationId: string;
    messageId: string;
    direction: MessageDirection;
    senderJid: string;
    type: MessageType;
    content: any;
    status: MessageStatus;
    timestamp: Date;
    metadata?: Record<string, any>;
}
interface SendTextOptions {
    profileId: string;
    to: string;
    text: string;
}
interface SendMediaOptions {
    profileId: string;
    to: string;
    url?: string;
    base64?: string;
    caption?: string;
    filename?: string;
}
interface SendLocationOptions {
    profileId: string;
    to: string;
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
}
interface SendContactOptions {
    profileId: string;
    to: string;
    contacts: VCardContact[];
}
interface VCardContact {
    name: string;
    phone: string;
    organization?: string;
}
interface SendReactionOptions {
    profileId: string;
    messageId: string;
    emoji: string;
}
interface SendReplyOptions {
    profileId: string;
    to: string;
    quotedMessageId: string;
    text: string;
}
interface Contact {
    id: string;
    profileId: string;
    phone: string;
    name?: string;
    whatsappName?: string;
    tags: string[];
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
interface CreateContactOptions {
    profileId: string;
    phone: string;
    name?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}
interface UpdateContactOptions {
    name?: string;
    phone?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}
interface ImportContactsOptions {
    profileId: string;
    contacts: {
        phone: string;
        name?: string;
        tags?: string[];
    }[];
}
interface ImportCsvOptions {
    profileId: string;
    csvData: string;
}
interface Conversation {
    id: string;
    profileId: string;
    jid: string;
    name?: string;
    type: 'user' | 'group' | 'broadcast';
    unreadCount: number;
    lastMessageAt?: Date;
    createdAt: Date;
}
interface Template {
    id: string;
    profileId: string;
    name: string;
    category?: string;
    messageType: string;
    content: any;
    variables: string[];
    usageCount: number;
    createdAt: Date;
}
interface CreateTemplateOptions {
    profileId: string;
    name: string;
    category?: string;
    messageType?: string;
    content: any;
}
interface PreviewTemplateOptions {
    variables: Record<string, string>;
}
type BroadcastStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
interface Broadcast {
    id: string;
    profileId: string;
    name: string;
    message: any;
    recipients: BroadcastRecipients;
    status: BroadcastStatus;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    stats: BroadcastStats;
    createdAt: Date;
}
interface BroadcastRecipients {
    type: 'tags' | 'contacts' | 'all';
    value: string[];
}
interface BroadcastStats {
    total: number;
    pending: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
}
interface CreateBroadcastOptions {
    profileId: string;
    name: string;
    message: any;
    recipients: BroadcastRecipients;
    settings?: {
        delayMin?: number;
        delayMax?: number;
        batchSize?: number;
        retryFailed?: boolean;
        retryAttempts?: number;
    };
}
interface Webhook {
    id: string;
    profileId: string;
    url: string;
    events: string[];
    secret: string;
    enabled: boolean;
    createdAt: Date;
}
interface CreateWebhookOptions {
    profileId: string;
    url: string;
    events: string[];
    secret?: string;
    headers?: Record<string, string>;
}
type TriggerType = 'keyword' | 'regex' | 'new_contact' | 'message_type' | 'all';
interface Automation {
    id: string;
    profileId: string;
    name: string;
    isActive: boolean;
    priority: number;
    triggerType: TriggerType;
    triggerConfig: any;
    conditions: any[];
    actions: any[];
    cooldownSecs: number;
    maxTriggersPerDay?: number;
    stats: any;
    createdAt: Date;
}
interface CreateAutomationOptions {
    profileId: string;
    name: string;
    triggerType: TriggerType;
    triggerConfig: any;
    conditions?: any[];
    actions: any[];
    cooldownSecs?: number;
    maxTriggersPerDay?: number;
}

declare class MessageClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * Send a text message
     */
    sendText(options: SendTextOptions): Promise<Message>;
    /**
     * Send an image message
     */
    sendImage(options: SendMediaOptions): Promise<Message>;
    /**
     * Send a video message
     */
    sendVideo(options: SendMediaOptions): Promise<Message>;
    /**
     * Send an audio message (including voice notes)
     */
    sendAudio(options: SendMediaOptions & {
        ptt?: boolean;
    }): Promise<Message>;
    /**
     * Send a document
     */
    sendDocument(options: SendMediaOptions): Promise<Message>;
    /**
     * Send a location
     */
    sendLocation(options: SendLocationOptions): Promise<Message>;
    /**
     * Send contact cards (vCard)
     */
    sendContact(options: SendContactOptions): Promise<Message>;
    /**
     * Send a reaction to a message
     */
    sendReaction(options: SendReactionOptions): Promise<Message>;
    /**
     * Reply to a message
     */
    sendReply(options: SendReplyOptions): Promise<Message>;
    /**
     * Get message history for a conversation
     */
    list(conversationId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<Message>>;
    /**
     * Get a specific message by ID
     */
    get(id: string): Promise<Message>;
}

declare class ContactClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * Create a new contact
     */
    create(options: CreateContactOptions): Promise<Contact>;
    /**
     * List contacts with filtering
     */
    list(profileId: string, options?: {
        search?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<Contact>>;
    /**
     * Get a contact by ID
     */
    get(id: string): Promise<Contact>;
    /**
     * Update a contact
     */
    update(id: string, data: UpdateContactOptions): Promise<Contact>;
    /**
     * Delete a contact
     */
    delete(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * Bulk import contacts from JSON array
     */
    import(options: ImportContactsOptions): Promise<{
        created: number;
        updated: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Import contacts from CSV data
     */
    importCsv(options: ImportCsvOptions): Promise<{
        created: number;
        updated: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Export contacts to CSV
     */
    exportCsv(profileId: string, options?: {
        tags?: string[];
    }): Promise<{
        csv: string;
        count: number;
        filename: string;
    }>;
    /**
     * Add tags to a contact
     */
    addTags(id: string, tags: string[]): Promise<Contact>;
    /**
     * Remove tags from a contact
     */
    removeTags(id: string, tags: string[]): Promise<Contact>;
    /**
     * Validate a phone number
     */
    validatePhone(profileId: string, phone: string): Promise<{
        phone: string;
        validFormat: boolean;
        isIndonesian: boolean;
        onWhatsApp: boolean | null;
    }>;
    /**
     * Bulk validate phone numbers
     */
    validateBulk(profileId: string, phones: string[]): Promise<{
        total: number;
        valid: number;
        results: any[];
    }>;
}

declare class ConversationClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * List conversations
     */
    list(profileId: string, options?: {
        search?: string;
        type?: string;
        archived?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<Conversation>>;
    /**
     * Get a conversation by ID
     */
    get(id: string): Promise<Conversation>;
    /**
     * Get messages in a conversation
     */
    getMessages(id: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<Message>>;
    /**
     * Archive a conversation
     */
    archive(id: string): Promise<Conversation>;
    /**
     * Unarchive a conversation
     */
    unarchive(id: string): Promise<Conversation>;
    /**
     * Mark conversation as read
     */
    markAsRead(id: string): Promise<Conversation>;
}

declare class TemplateClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * Create a new template
     */
    create(options: CreateTemplateOptions): Promise<Template>;
    /**
     * List templates
     */
    list(profileId: string, options?: {
        category?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<Template>>;
    /**
     * Get a template by ID
     */
    get(id: string): Promise<Template>;
    /**
     * Update a template
     */
    update(id: string, data: Partial<CreateTemplateOptions>): Promise<Template>;
    /**
     * Delete a template
     */
    delete(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * Preview template with variables
     */
    preview(id: string, variables: Record<string, string>): Promise<{
        rendered: any;
        variables: string[];
    }>;
    /**
     * Duplicate a template
     */
    duplicate(id: string, newName: string): Promise<Template>;
}

declare class BroadcastClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * Create a new broadcast
     */
    create(options: CreateBroadcastOptions): Promise<Broadcast>;
    /**
     * List broadcasts
     */
    list(profileId: string, options?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<Broadcast>>;
    /**
     * Get a broadcast by ID
     */
    get(id: string): Promise<Broadcast>;
    /**
     * Update a broadcast (draft only)
     */
    update(id: string, data: Partial<CreateBroadcastOptions>): Promise<Broadcast>;
    /**
     * Delete a broadcast
     */
    delete(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * Schedule a broadcast
     */
    schedule(id: string, scheduledAt: Date | string): Promise<Broadcast>;
    /**
     * Start broadcast immediately
     */
    start(id: string): Promise<{
        success: boolean;
        recipientCount: number;
    }>;
    /**
     * Pause a running broadcast
     */
    pause(id: string): Promise<Broadcast>;
    /**
     * Resume a paused broadcast
     */
    resume(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * Cancel a broadcast
     */
    cancel(id: string): Promise<Broadcast>;
    /**
     * Get broadcast statistics
     */
    getStats(id: string): Promise<BroadcastStats & {
        successRate: number;
        progress: number;
        duration: number | null;
    }>;
    /**
     * Get broadcast recipients
     */
    getRecipients(id: string, options?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<any>>;
}

declare class WebhookClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * Create a new webhook
     */
    create(options: CreateWebhookOptions): Promise<Webhook>;
    /**
     * List webhooks
     */
    list(profileId: string): Promise<Webhook[]>;
    /**
     * Get a webhook by ID
     */
    get(id: string): Promise<Webhook>;
    /**
     * Update a webhook
     */
    update(id: string, data: Partial<CreateWebhookOptions>): Promise<Webhook>;
    /**
     * Delete a webhook
     */
    delete(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * Test webhook delivery
     */
    test(id: string): Promise<{
        success: boolean;
        statusCode: number;
        responseTime: number;
    }>;
    /**
     * Get webhook delivery logs
     */
    getLogs(id: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<PaginatedResponse<{
        id: string;
        event: string;
        payload: any;
        statusCode: number;
        success: boolean;
        createdAt: Date;
    }>>;
}

declare class AutomationClient {
    private client;
    constructor(client: MultiWAClient);
    /**
     * Create a new automation
     */
    create(options: CreateAutomationOptions): Promise<Automation>;
    /**
     * List automations
     */
    list(profileId: string, options?: {
        triggerType?: string;
        isActive?: boolean;
    }): Promise<Automation[]>;
    /**
     * Get an automation by ID
     */
    get(id: string): Promise<Automation>;
    /**
     * Update an automation
     */
    update(id: string, data: Partial<CreateAutomationOptions>): Promise<Automation>;
    /**
     * Delete an automation
     */
    delete(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * Toggle automation on/off
     */
    toggle(id: string): Promise<Automation>;
    /**
     * Test automation with sample message
     */
    test(id: string, message: string): Promise<{
        matches: boolean;
        matchDetails: any;
        actions: any[] | null;
    }>;
    /**
     * Get automation statistics
     */
    getStats(id: string): Promise<{
        triggerCount: number;
        lastTriggered: Date | null;
        todayCount: number;
    }>;
    /**
     * Reorder automation priorities
     */
    reorder(profileId: string, order: string[]): Promise<{
        success: boolean;
    }>;
}

interface MultiWAClientOptions {
    /**
     * API base URL. Must include the API prefix `/api/v1`.
     *
     * - Local dev default: `http://localhost:3000/api/v1`
     * - Docker default:    `http://localhost:3333/api/v1`
     * - Production:        `https://your-host/api/v1`
     */
    baseUrl?: string;
    /** API key for authentication */
    apiKey: string;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Custom headers to include in all requests */
    headers?: Record<string, string>;
}
/**
 * Join an API base URL with an endpoint path while preserving the base path.
 *
 * `new URL('/messages/text', 'http://host/api/v1')` would drop `/api/v1`
 * because a path beginning with `/` is treated as absolute. This helper
 * normalizes both sides and concatenates them, so the base path survives.
 *
 * Examples:
 *   joinApiUrl('http://localhost:3333/api/v1',  'messages/text')
 *     => 'http://localhost:3333/api/v1/messages/text'
 *   joinApiUrl('http://localhost:3333/api/v1',  '/messages/text')
 *     => 'http://localhost:3333/api/v1/messages/text'
 *   joinApiUrl('http://localhost:3333/api/v1/', 'messages/text')
 *     => 'http://localhost:3333/api/v1/messages/text'
 */
declare function joinApiUrl(baseUrl: string, path: string): string;
declare class MultiWAClient {
    private options;
    messages: MessageClient;
    contacts: ContactClient;
    conversations: ConversationClient;
    templates: TemplateClient;
    broadcasts: BroadcastClient;
    webhooks: WebhookClient;
    automations: AutomationClient;
    constructor(options: MultiWAClientOptions);
    request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options?: {
        body?: any;
        query?: Record<string, any>;
    }): Promise<T>;
    get<T>(path: string, query?: Record<string, any>): Promise<T>;
    post<T>(path: string, body?: any, query?: Record<string, any>): Promise<T>;
    put<T>(path: string, body?: any, query?: Record<string, any>): Promise<T>;
    delete<T>(path: string, query?: Record<string, any>): Promise<T>;
}

export { type ApiResponse, type Automation, AutomationClient, type Broadcast, BroadcastClient, type BroadcastRecipients, type BroadcastStats, type BroadcastStatus, type Contact, ContactClient, type Conversation, ConversationClient, type CreateAutomationOptions, type CreateBroadcastOptions, type CreateContactOptions, type CreateTemplateOptions, type CreateWebhookOptions, type ImportContactsOptions, type ImportCsvOptions, type Message, MessageClient, type MessageDirection, type MessageStatus, type MessageType, MultiWAClient, type MultiWAClientOptions, type PaginatedResponse, type PreviewTemplateOptions, type SendContactOptions, type SendLocationOptions, type SendMediaOptions, type SendReactionOptions, type SendReplyOptions, type SendTextOptions, type Template, TemplateClient, type TriggerType, type UpdateContactOptions, type VCardContact, type Webhook, WebhookClient, joinApiUrl };
