/**
 * MultiWA ↔ Chatwoot Bridge
 *
 * Bridges WhatsApp messages between MultiWA Gateway and Chatwoot.
 * - Receives webhooks from MultiWA → creates/updates Chatwoot conversations
 * - Receives webhooks from Chatwoot → sends messages via MultiWA
 */
export interface ChatwootBridgeConfig {
    /** MultiWA API base URL */
    multiwaUrl: string;
    /** MultiWA API key */
    multiwaApiKey: string;
    /** MultiWA Profile ID */
    multiwaProfileId: string;
    /** Chatwoot API base URL */
    chatwootUrl: string;
    /** Chatwoot API access token (user or agent bot) */
    chatwootAccessToken: string;
    /** Chatwoot Account ID */
    chatwootAccountId: number;
    /** Chatwoot Inbox ID for WhatsApp */
    chatwootInboxId: number;
    /** Port to listen on */
    port?: number;
}
export declare class ChatwootBridge {
    private config;
    private multiwaClient;
    private chatwootClient;
    private app;
    constructor(config: ChatwootBridgeConfig);
    private setupRoutes;
    /**
     * Handle incoming MultiWA webhook (WhatsApp message received).
     * Creates or finds a Chatwoot conversation and adds the message.
     */
    private handleMultiwaWebhook;
    /**
     * Handle Chatwoot webhook (agent sends reply).
     * Forwards the message to WhatsApp via MultiWA.
     */
    private handleChatwootWebhook;
    private findOrCreateChatwootContact;
    private findOrCreateConversation;
    /** Start the bridge server */
    start(): void;
}
//# sourceMappingURL=index.d.ts.map