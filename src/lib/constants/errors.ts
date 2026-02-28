import { MAX_CHAT_MESSAGES_PER_CONVERSATION } from "./ai";

// =============================================================================
// ENTITY NOT FOUND
// =============================================================================

export const ERR_TRADE_NOT_FOUND = "Trade not found";
export const ERR_ACCOUNT_NOT_FOUND = "Account not found";
export const ERR_STRATEGY_NOT_FOUND = "Strategy not found";
export const ERR_TAG_NOT_FOUND = "Tag not found";
export const ERR_EXECUTION_NOT_FOUND = "Execution not found";
export const ERR_TEMPLATE_NOT_FOUND = "Template not found";
export const ERR_JOURNAL_NOT_FOUND = "Journal not found";
export const ERR_ATTACHMENT_NOT_FOUND = "Attachment not found";
export const ERR_GROUP_NOT_FOUND = "Group not found";
export const ERR_CONVERSATION_NOT_FOUND = "Conversation not found";
export const ERR_REPORT_NOT_FOUND = "Report not found";
export const ERR_REPORT_CONVERSATION_NOT_FOUND =
	"Report conversation not found";
export const ERR_CHALLENGE_ACCOUNT_NOT_FOUND = "Challenge account not found";
export const ERR_DELETED_TRADE_NOT_FOUND = "Deleted trade not found";
export const ERR_PRESET_NOT_FOUND = "Preset not found or access denied";
export const ERR_FILTER_PRESET_NOT_FOUND = "Filter preset not found";

// =============================================================================
// CREATION / MUTATION FAILURES
// =============================================================================

export const ERR_TRADE_CREATE_FAILED = "Failed to create trade";
export const ERR_STRATEGY_CREATE_FAILED = "Failed to create strategy";
export const ERR_CONVERSATION_CREATE_FAILED = "Failed to create conversation";
export const ERR_REPORT_CONVERSATION_CREATE_FAILED =
	"Failed to create report conversation";
export const ERR_REPORT_CREATE_FAILED = "Failed to create report";
export const ERR_JOURNAL_CREATE_FAILED = "Failed to create journal";
export const ERR_JOURNAL_FIND_OR_CREATE_FAILED =
	"Failed to find or create journal";
export const ERR_TEMPLATE_CREATE_FAILED = "Failed to create template";
export const ERR_ATTACHMENT_CREATE_FAILED = "Failed to create attachment";
export const ERR_MESSAGE_SAVE_FAILED = "Failed to save user message";
export const ERR_STRATEGY_DUPLICATE_FAILED = "Failed to duplicate strategy";
export const ERR_MAEMFE_CALCULATE_FAILED = "Failed to calculate MAE/MFE";

// =============================================================================
// BULK OPERATIONS
// =============================================================================

export const ERR_TRADES_BULK_NOT_FOUND =
	"Some trades not found or don't belong to you";

// =============================================================================
// VALIDATION (backend)
// =============================================================================

export const ERR_TAG_NAME_EXISTS = "Tag with this name already exists";
export const ERR_ACCOUNT_NOT_CHALLENGE =
	"Account is not a prop challenge account";
export const ERR_ACCOUNT_NOT_PROP = "Account is not a prop account";
export const ERR_TRADE_NO_STRATEGY = "Trade has no strategy assigned";
export const ERR_REPORT_ONLY_FAILED_RETRY =
	"Only failed reports can be retried";
export const ERR_CHECKLIST_AUTO_CALCULATED =
	"Cannot toggle this item - it is auto-calculated";
export const ERR_ACCESS_DENIED = "Access denied";

/** Dynamic: Template {id} not found or not owned by user */
export const errTemplateNotOwned = (id: string) =>
	`Template ${id} not found or not owned by user`;

/** Dynamic: Message limit reached */
export const errMessageLimitReached = (limit: number) =>
	`Message limit reached (${limit}). Please start a new conversation.`;

// =============================================================================
// VALIDATION (frontend)
// =============================================================================

export const ERR_VALIDATION_ACCOUNT_REQUIRED =
	"Please select a trading account";
export const ERR_VALIDATION_ACCOUNT_NAME_REQUIRED = "Account name is required";
export const ERR_VALIDATION_GROUP_NAME_REQUIRED = "Group name is required";
export const ERR_VALIDATION_REQUIRED_FIELDS =
	"Please fill in all required fields";
export const ERR_VALIDATION_EXIT_DETAILS =
	"Please provide exit details or mark trade as still open";
export const ERR_VALIDATION_PNL_REQUIRED =
	"Please enter the realized P&L for this trade";
export const ERR_VALIDATION_PNL_REQUIRED_SHORT =
	"Please enter the realized P&L";
export const ERR_VALIDATION_CSV_UPLOAD = "Please upload a CSV file";
export const ERR_VALIDATION_SELECT_ACCOUNT = "Please select an account";
export const ERR_VALIDATION_IMAGES_ONLY = "Only image files are allowed";
export const ERR_VALIDATION_DATE_RANGE = "End date must be after start date";

// =============================================================================
// CSV IMPORT
// =============================================================================

export const ERR_CSV_HEADERS_AND_DATA =
	"CSV file must have headers and at least one data row";
export const ERR_CSV_MISSING_HEADERS = "CSV file must have headers";
export const ERR_CSV_AUTOPARSE_FAILED =
	"Auto-parse failed. Please map columns manually.";

// =============================================================================
// FRONTEND FALLBACK ERRORS (used with getErrorMessage)
// =============================================================================

export const ERR_TRADE_DELETE_FAILED = "Failed to delete trade";
export const ERR_TRADES_DELETE_FAILED = "Failed to delete trades";
export const ERR_TRADE_RESTORE_FAILED = "Failed to restore trade";
export const ERR_TRADE_CLOSE_FAILED = "Failed to close trade";
export const ERR_TRADE_UPDATE_FAILED = "Failed to update";
export const ERR_TRASH_EMPTY_FAILED = "Failed to empty trash";
export const ERR_RATING_UPDATE_FAILED = "Failed to update rating";
export const ERR_REVIEW_UPDATE_FAILED = "Failed to update review status";
export const ERR_STRATEGY_UPDATE_FAILED = "Failed to update strategy";
export const ERR_STRATEGY_DELETE_FAILED = "Failed to delete strategy";
export const ERR_STRATEGY_DUPLICATE_UI_FAILED = "Failed to duplicate strategy";
export const ERR_ACCOUNT_CREATE_FAILED = "Failed to create account";
export const ERR_ACCOUNT_UPDATE_FAILED = "Failed to update account";
export const ERR_ACCOUNT_DELETE_FAILED = "Failed to delete account";
export const ERR_ACCOUNT_SET_DEFAULT_FAILED = "Failed to set default account";
export const ERR_ACCOUNT_CONVERT_FAILED = "Failed to convert account";
export const ERR_CHALLENGE_MARK_FAILED = "Failed to mark challenge as failed";
export const ERR_GROUP_CREATE_FAILED = "Failed to create group";
export const ERR_GROUP_UPDATE_FAILED = "Failed to update group";
export const ERR_GROUP_DELETE_FAILED = "Failed to delete group";
export const ERR_SETTINGS_SAVE_FAILED = "Failed to save settings";
export const ERR_TAG_CREATE_FAILED = "Failed to create tag";
export const ERR_TAG_UPDATE_FAILED = "Failed to update tag";
export const ERR_TAG_DELETE_FAILED = "Failed to delete tag";
export const ERR_TAG_ADD_FAILED = "Failed to add tag";
export const ERR_TAG_REMOVE_FAILED = "Failed to remove tag";
export const ERR_IMPORT_FAILED = "Failed to import trades. Please try again.";
export const ERR_PRESET_LOAD_FAILED = "Failed to load preset";
export const ERR_RULE_UPDATE_FAILED = "Failed to update rule";
export const ERR_UPLOAD_FAILED = "Upload failed";
export const ERR_BUG_REPORT_CREATE_FAILED = "Failed to create bug report";
export const ERR_BUG_REPORT_SUBMIT_FAILED =
	"Failed to submit bug report. Please try again.";

// =============================================================================
// CONFIGURATION / INFRASTRUCTURE
// =============================================================================

export const ERR_S3_NOT_CONFIGURED =
	"File uploads are not configured. S3 settings are missing.";
export const ERR_S3_DOWNLOADS_NOT_CONFIGURED =
	"File downloads are not configured. S3 settings are missing.";

// =============================================================================
// AI REPORT (user-friendly messages for trigger task)
// =============================================================================

export const ERR_AI_RATE_LIMIT =
	"The AI service is currently busy. Please wait a minute and try again.";
export const ERR_AI_QUOTA =
	"The AI service quota has been reached. Please try again later.";
export const ERR_AI_TIMEOUT =
	"The report took too long to generate. Try a narrower date range or simpler prompt.";
export const ERR_AI_UNAVAILABLE =
	"The AI service is temporarily unavailable. Please try again in a few minutes.";
export const ERR_AI_CONNECTION =
	"Could not connect to the AI service. Please try again shortly.";
export const ERR_AI_CONTENT_FILTER =
	"The request was flagged by content filters. Try rephrasing your prompt.";
export const ERR_AI_CONTEXT_LENGTH =
	"Too much data for the AI to process at once. Try a narrower date range.";
export const ERR_AI_OWNERSHIP =
	"This report could not be found. It may have been deleted.";
export const ERR_AI_NOT_FOUND =
	"The requested resource could not be found. Please try generating a new report.";
export const ERR_AI_NO_DATA =
	"No trading data found for the selected period. Try adjusting your date range.";
export const ERR_AI_GENERIC =
	"Something went wrong while generating your report. Please try again.";
export const ERR_AI_REPORT_FALLBACK =
	"Report generation failed. Please try again or contact support if the issue persists.";

// =============================================================================
// SHARING
// =============================================================================

export const ERR_SHARE_LINK_NOT_FOUND = "Share link not found";
export const ERR_SHARE_LINK_EXPIRED = "This share link has expired";
export const ERR_SHARE_LINK_REVOKED = "This share link has been revoked";
export const ERR_SHARE_LINK_LIMIT_REACHED =
	"Maximum number of share links reached for this resource";
export const ERR_SHARE_RESOURCE_NOT_FOUND = "Shared resource not found";
export const ERR_SHARE_RESOURCE_NOT_COMPLETE =
	"Resource must be complete before sharing";

// =============================================================================
// ADMIN PANEL
// =============================================================================

export const ERR_ADMIN_FORBIDDEN = "Access denied. Admin privileges required.";
export const ERR_ADMIN_USER_NOT_FOUND = "User not found";
export const ERR_ADMIN_INVALID_STATUS_TRANSITION =
	"Invalid bug report status transition";
export const ERR_ADMIN_BUG_REPORT_NOT_FOUND = "Bug report not found";
export const ERR_ADMIN_ROLE_UPDATE_FAILED = "Failed to update user role";
export const ERR_ADMIN_CONVERSATION_NOT_FOUND = "Conversation not found";

// Admin frontend error messages
export const ERR_ADMIN_LOAD_STATS_FAILED = "Failed to load platform stats";
export const ERR_ADMIN_LOAD_BUG_REPORTS_FAILED = "Failed to load bug reports";
export const ERR_ADMIN_LOAD_USERS_FAILED = "Failed to load users";
export const ERR_ADMIN_LOAD_CONVERSATIONS_FAILED =
	"Failed to load conversations";

// Pre-computed message limit error
export const ERR_MESSAGE_LIMIT_REACHED = errMessageLimitReached(
	MAX_CHAT_MESSAGES_PER_CONVERSATION,
);
