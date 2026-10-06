/**
 * The registry tools the Inbox module runs, by name.
 *
 * Kept in a file of its own with no imports, so the hub (which asks the gate
 * about every tool once per request) and the governance module (which needs
 * to know which tools publish their own backbone events) can read the list
 * without loading the handlers or the read model.
 */

/**
 * Tools whose handler publishes its own backbone event, inside its own
 * transaction, so the record and the event cannot disagree. The governance
 * module must not publish a second account of them.
 */
export const INBOX_SELF_PUBLISHING_TOOLS = [
  "recordInboxTriage",
  "linkInboxMessage",
  "fileInboxMessageAsEvidence",
  "addInboxMessageToProcess",
  "delegateInboxMessage",
  "sendInboxReply",
] as const;

/** The draft tool. It writes nothing and publishes nothing. */
export const INBOX_DRAFT_TOOL = "draftInboxReply" as const;

/**
 * Every tool the inbox can run. `createAction` is the existing governed action
 * tool: a message becomes an action through it, with the message as the
 * action's source, and not through a second action writer.
 */
export const INBOX_TOOLS: readonly string[] = [
  ...INBOX_SELF_PUBLISHING_TOOLS,
  INBOX_DRAFT_TOOL,
  "createAction",
];

export type InboxSelfPublishingTool = (typeof INBOX_SELF_PUBLISHING_TOOLS)[number];
