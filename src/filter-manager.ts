import { gmail_v1 } from "googleapis";
import type {
  GmailFilterCriteria,
  GmailFilterAction,
  GmailFilter,
  FilterListResult,
} from "./types.js";

/**
 * Creates a Gmail filter with the specified criteria and action.
 */
export async function createFilter(
  gmail: gmail_v1.Gmail,
  criteria: GmailFilterCriteria,
  action: GmailFilterAction
): Promise<GmailFilter> {
  try {
    const filterBody: GmailFilter = { criteria, action };
    const response = await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: filterBody,
    });
    return response.data as GmailFilter;
  } catch (error: unknown) {
    const apiError = error as { code?: number; message?: string };
    if (apiError.code === 400) {
      throw new Error(
        `Invalid filter criteria or action: ${apiError.message}`
      );
    }
    throw new Error(`Failed to create filter: ${apiError.message}`);
  }
}

/**
 * Lists all Gmail filters for the authenticated user.
 */
export async function listFilters(
  gmail: gmail_v1.Gmail
): Promise<FilterListResult> {
  try {
    const response = await gmail.users.settings.filters.list({
      userId: "me",
    });
    const filters = (response.data.filter ?? []) as GmailFilter[];
    return { filters, count: filters.length };
  } catch (error: unknown) {
    const apiError = error as { code?: number; message?: string };
    throw new Error(`Failed to list filters: ${apiError.message}`);
  }
}

/**
 * Retrieves a specific Gmail filter by ID.
 */
export async function getFilter(
  gmail: gmail_v1.Gmail,
  filterId: string
): Promise<GmailFilter> {
  try {
    const response = await gmail.users.settings.filters.get({
      userId: "me",
      id: filterId,
    });
    return response.data as GmailFilter;
  } catch (error: unknown) {
    const apiError = error as { code?: number; message?: string };
    if (apiError.code === 404) {
      throw new Error(`Filter with ID "${filterId}" not found.`);
    }
    throw new Error(`Failed to get filter: ${apiError.message}`);
  }
}

/**
 * Deletes a Gmail filter by ID.
 */
export async function deleteFilter(
  gmail: gmail_v1.Gmail,
  filterId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await gmail.users.settings.filters.delete({
      userId: "me",
      id: filterId,
    });
    return {
      success: true,
      message: `Filter "${filterId}" deleted successfully.`,
    };
  } catch (error: unknown) {
    const apiError = error as { code?: number; message?: string };
    if (apiError.code === 404) {
      throw new Error(`Filter with ID "${filterId}" not found.`);
    }
    throw new Error(`Failed to delete filter: ${apiError.message}`);
  }
}

/**
 * Pre-built filter templates for common Gmail filtering patterns.
 */
export const filterTemplates = {
  fromSender(
    senderEmail: string,
    labelIds: string[] = [],
    archive: boolean = false
  ): { criteria: GmailFilterCriteria; action: GmailFilterAction } {
    return {
      criteria: { from: senderEmail },
      action: {
        addLabelIds: labelIds,
        removeLabelIds: archive ? ["INBOX"] : undefined,
      },
    };
  },

  withSubject(
    subjectText: string,
    labelIds: string[] = [],
    markAsRead: boolean = false
  ): { criteria: GmailFilterCriteria; action: GmailFilterAction } {
    return {
      criteria: { subject: subjectText },
      action: {
        addLabelIds: labelIds,
        removeLabelIds: markAsRead ? ["UNREAD"] : undefined,
      },
    };
  },

  withAttachments(
    labelIds: string[] = []
  ): { criteria: GmailFilterCriteria; action: GmailFilterAction } {
    return {
      criteria: { hasAttachment: true },
      action: { addLabelIds: labelIds },
    };
  },

  largeEmails(
    sizeInBytes: number,
    labelIds: string[] = []
  ): { criteria: GmailFilterCriteria; action: GmailFilterAction } {
    return {
      criteria: { size: sizeInBytes, sizeComparison: "larger" },
      action: { addLabelIds: labelIds },
    };
  },

  containingText(
    searchText: string,
    labelIds: string[] = [],
    markImportant: boolean = false
  ): { criteria: GmailFilterCriteria; action: GmailFilterAction } {
    return {
      criteria: { query: `"${searchText}"` },
      action: {
        addLabelIds: markImportant ? [...labelIds, "IMPORTANT"] : labelIds,
      },
    };
  },

  mailingList(
    listIdentifier: string,
    labelIds: string[] = [],
    archive: boolean = true
  ): { criteria: GmailFilterCriteria; action: GmailFilterAction } {
    return {
      criteria: {
        query: `list:${listIdentifier} OR subject:[${listIdentifier}]`,
      },
      action: {
        addLabelIds: labelIds,
        removeLabelIds: archive ? ["INBOX"] : undefined,
      },
    };
  },
};
