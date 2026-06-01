"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AutomationClient: () => AutomationClient,
  BroadcastClient: () => BroadcastClient,
  ContactClient: () => ContactClient,
  ConversationClient: () => ConversationClient,
  MessageClient: () => MessageClient,
  MultiWAClient: () => MultiWAClient,
  TemplateClient: () => TemplateClient,
  WebhookClient: () => WebhookClient,
  joinApiUrl: () => joinApiUrl
});
module.exports = __toCommonJS(index_exports);

// src/clients/messages.ts
var MessageClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Send a text message
   */
  async sendText(options) {
    return this.client.post("/messages/text", options);
  }
  /**
   * Send an image message
   */
  async sendImage(options) {
    return this.client.post("/messages/image", options);
  }
  /**
   * Send a video message
   */
  async sendVideo(options) {
    return this.client.post("/messages/video", options);
  }
  /**
   * Send an audio message (including voice notes)
   */
  async sendAudio(options) {
    return this.client.post("/messages/audio", options);
  }
  /**
   * Send a document
   */
  async sendDocument(options) {
    return this.client.post("/messages/document", options);
  }
  /**
   * Send a location
   */
  async sendLocation(options) {
    return this.client.post("/messages/location", options);
  }
  /**
   * Send contact cards (vCard)
   */
  async sendContact(options) {
    return this.client.post("/messages/contact", options);
  }
  /**
   * Send a reaction to a message
   */
  async sendReaction(options) {
    return this.client.post("/messages/reaction", options);
  }
  /**
   * Reply to a message
   */
  async sendReply(options) {
    return this.client.post("/messages/reply", options);
  }
  /**
   * Get message history for a conversation
   */
  async list(conversationId, options) {
    return this.client.get(`/conversations/${conversationId}/messages`, options);
  }
  /**
   * Get a specific message by ID
   */
  async get(id) {
    return this.client.get(`/messages/${id}`);
  }
};

// src/clients/contacts.ts
var ContactClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Create a new contact
   */
  async create(options) {
    return this.client.post("/contacts", options);
  }
  /**
   * List contacts with filtering
   */
  async list(profileId, options) {
    return this.client.get("/contacts", { profileId, ...options });
  }
  /**
   * Get a contact by ID
   */
  async get(id) {
    return this.client.get(`/contacts/${id}`);
  }
  /**
   * Update a contact
   */
  async update(id, data) {
    return this.client.put(`/contacts/${id}`, data);
  }
  /**
   * Delete a contact
   */
  async delete(id) {
    return this.client.delete(`/contacts/${id}`);
  }
  /**
   * Bulk import contacts from JSON array
   */
  async import(options) {
    return this.client.post("/contacts/import", options);
  }
  /**
   * Import contacts from CSV data
   */
  async importCsv(options) {
    return this.client.post("/contacts/import/csv", options);
  }
  /**
   * Export contacts to CSV
   */
  async exportCsv(profileId, options) {
    return this.client.get("/contacts/export/csv", { profileId, ...options });
  }
  /**
   * Add tags to a contact
   */
  async addTags(id, tags) {
    return this.client.post(`/contacts/${id}/tags`, { tags });
  }
  /**
   * Remove tags from a contact
   */
  async removeTags(id, tags) {
    return this.client.delete(`/contacts/${id}/tags`, { tags });
  }
  /**
   * Validate a phone number
   */
  async validatePhone(profileId, phone) {
    return this.client.get(`/contacts/profile/${profileId}/validate/${phone}`);
  }
  /**
   * Bulk validate phone numbers
   */
  async validateBulk(profileId, phones) {
    return this.client.post(`/contacts/profile/${profileId}/validate`, { phones });
  }
};

// src/clients/conversations.ts
var ConversationClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * List conversations
   */
  async list(profileId, options) {
    return this.client.get("/conversations", { profileId, ...options });
  }
  /**
   * Get a conversation by ID
   */
  async get(id) {
    return this.client.get(`/conversations/${id}`);
  }
  /**
   * Get messages in a conversation
   */
  async getMessages(id, options) {
    return this.client.get(`/conversations/${id}/messages`, options);
  }
  /**
   * Archive a conversation
   */
  async archive(id) {
    return this.client.post(`/conversations/${id}/archive`);
  }
  /**
   * Unarchive a conversation
   */
  async unarchive(id) {
    return this.client.post(`/conversations/${id}/unarchive`);
  }
  /**
   * Mark conversation as read
   */
  async markAsRead(id) {
    return this.client.post(`/conversations/${id}/read`);
  }
};

// src/clients/templates.ts
var TemplateClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Create a new template
   */
  async create(options) {
    return this.client.post("/templates", options);
  }
  /**
   * List templates
   */
  async list(profileId, options) {
    return this.client.get("/templates", { profileId, ...options });
  }
  /**
   * Get a template by ID
   */
  async get(id) {
    return this.client.get(`/templates/${id}`);
  }
  /**
   * Update a template
   */
  async update(id, data) {
    return this.client.put(`/templates/${id}`, data);
  }
  /**
   * Delete a template
   */
  async delete(id) {
    return this.client.delete(`/templates/${id}`);
  }
  /**
   * Preview template with variables
   */
  async preview(id, variables) {
    return this.client.post(`/templates/${id}/preview`, { variables });
  }
  /**
   * Duplicate a template
   */
  async duplicate(id, newName) {
    return this.client.post(`/templates/${id}/duplicate`, { name: newName });
  }
};

// src/clients/broadcast.ts
var BroadcastClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Create a new broadcast
   */
  async create(options) {
    return this.client.post("/broadcast", options);
  }
  /**
   * List broadcasts
   */
  async list(profileId, options) {
    return this.client.get("/broadcast", { profileId, ...options });
  }
  /**
   * Get a broadcast by ID
   */
  async get(id) {
    return this.client.get(`/broadcast/${id}`);
  }
  /**
   * Update a broadcast (draft only)
   */
  async update(id, data) {
    return this.client.put(`/broadcast/${id}`, data);
  }
  /**
   * Delete a broadcast
   */
  async delete(id) {
    return this.client.delete(`/broadcast/${id}`);
  }
  /**
   * Schedule a broadcast
   */
  async schedule(id, scheduledAt) {
    return this.client.post(`/broadcast/${id}/schedule`, {
      scheduledAt: typeof scheduledAt === "string" ? scheduledAt : scheduledAt.toISOString()
    });
  }
  /**
   * Start broadcast immediately
   */
  async start(id) {
    return this.client.post(`/broadcast/${id}/start`);
  }
  /**
   * Pause a running broadcast
   */
  async pause(id) {
    return this.client.post(`/broadcast/${id}/pause`);
  }
  /**
   * Resume a paused broadcast
   */
  async resume(id) {
    return this.client.post(`/broadcast/${id}/resume`);
  }
  /**
   * Cancel a broadcast
   */
  async cancel(id) {
    return this.client.post(`/broadcast/${id}/cancel`);
  }
  /**
   * Get broadcast statistics
   */
  async getStats(id) {
    return this.client.get(`/broadcast/${id}/stats`);
  }
  /**
   * Get broadcast recipients
   */
  async getRecipients(id, options) {
    return this.client.get(`/broadcast/${id}/recipients`, options);
  }
};

// src/clients/webhooks.ts
var WebhookClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Create a new webhook
   */
  async create(options) {
    return this.client.post("/webhooks", options);
  }
  /**
   * List webhooks
   */
  async list(profileId) {
    return this.client.get("/webhooks", { profileId });
  }
  /**
   * Get a webhook by ID
   */
  async get(id) {
    return this.client.get(`/webhooks/${id}`);
  }
  /**
   * Update a webhook
   */
  async update(id, data) {
    return this.client.put(`/webhooks/${id}`, data);
  }
  /**
   * Delete a webhook
   */
  async delete(id) {
    return this.client.delete(`/webhooks/${id}`);
  }
  /**
   * Test webhook delivery
   */
  async test(id) {
    return this.client.post(`/webhooks/${id}/test`);
  }
  /**
   * Get webhook delivery logs
   */
  async getLogs(id, options) {
    return this.client.get(`/webhooks/${id}/logs`, options);
  }
};

// src/clients/automation.ts
var AutomationClient = class {
  constructor(client) {
    this.client = client;
  }
  /**
   * Create a new automation
   */
  async create(options) {
    return this.client.post("/automation", options);
  }
  /**
   * List automations
   */
  async list(profileId, options) {
    return this.client.get("/automation", { profileId, ...options });
  }
  /**
   * Get an automation by ID
   */
  async get(id) {
    return this.client.get(`/automation/${id}`);
  }
  /**
   * Update an automation
   */
  async update(id, data) {
    return this.client.put(`/automation/${id}`, data);
  }
  /**
   * Delete an automation
   */
  async delete(id) {
    return this.client.delete(`/automation/${id}`);
  }
  /**
   * Toggle automation on/off
   */
  async toggle(id) {
    return this.client.put(`/automation/${id}/toggle`);
  }
  /**
   * Test automation with sample message
   */
  async test(id, message) {
    return this.client.post(`/automation/${id}/test`, { message });
  }
  /**
   * Get automation statistics
   */
  async getStats(id) {
    return this.client.get(`/automation/${id}/stats`);
  }
  /**
   * Reorder automation priorities
   */
  async reorder(profileId, order) {
    return this.client.post("/automation/reorder", { profileId, order });
  }
};

// src/client.ts
function joinApiUrl(baseUrl, path) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const rel = String(path || "").replace(/^\/+/, "");
  return rel.length ? `${base}/${rel}` : base;
}
var MultiWAClient = class {
  constructor(options) {
    this.options = {
      baseUrl: options.baseUrl || "http://localhost:3000/api/v1",
      apiKey: options.apiKey,
      timeout: options.timeout || 3e4,
      headers: options.headers || {}
    };
    this.messages = new MessageClient(this);
    this.contacts = new ContactClient(this);
    this.conversations = new ConversationClient(this);
    this.templates = new TemplateClient(this);
    this.broadcasts = new BroadcastClient(this);
    this.webhooks = new WebhookClient(this);
    this.automations = new AutomationClient(this);
  }
  // HTTP request wrapper
  async request(method, path, options) {
    const url = new URL(joinApiUrl(this.options.baseUrl, path));
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== void 0 && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.options.apiKey,
          ...this.options.headers
        },
        body: options?.body ? JSON.stringify(options.body) : void 0,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new MultiWAError(
          error.message || `HTTP ${response.status}`,
          response.status,
          error
        );
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new MultiWAError("Request timeout", 408);
      }
      throw error;
    }
  }
  // Convenience methods
  get(path, query) {
    return this.request("GET", path, { query });
  }
  post(path, body, query) {
    return this.request("POST", path, { body, query });
  }
  put(path, body, query) {
    return this.request("PUT", path, { body, query });
  }
  delete(path, query) {
    return this.request("DELETE", path, { query });
  }
};
var MultiWAError = class extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "MultiWAError";
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AutomationClient,
  BroadcastClient,
  ContactClient,
  ConversationClient,
  MessageClient,
  MultiWAClient,
  TemplateClient,
  WebhookClient,
  joinApiUrl
});
