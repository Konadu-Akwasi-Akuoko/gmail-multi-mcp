import { gmail_v1 } from "googleapis";
import type { GmailLabel, LabelOptions, LabelListResult } from "./types.js";

interface GmailApiError {
  code?: number;
  message?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getApiErrorCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as GmailApiError).code === "number"
  ) {
    return (error as GmailApiError).code;
  }
  return undefined;
}

export async function createLabel(
  gmail: gmail_v1.Gmail,
  labelName: string,
  options: LabelOptions = {}
): Promise<GmailLabel> {
  try {
    const messageListVisibility =
      options.messageListVisibility || "show";
    const labelListVisibility =
      options.labelListVisibility || "labelShow";

    const response = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        messageListVisibility,
        labelListVisibility,
      },
    });

    return response.data as GmailLabel;
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    if (message.includes("already exists")) {
      throw new Error(`Label "${labelName}" already exists.`);
    }
    throw new Error(`Failed to create label: ${message}`);
  }
}

export async function updateLabel(
  gmail: gmail_v1.Gmail,
  labelId: string,
  updates: {
    name?: string;
    messageListVisibility?: string;
    labelListVisibility?: string;
  }
): Promise<GmailLabel> {
  try {
    await gmail.users.labels.get({ userId: "me", id: labelId });

    const response = await gmail.users.labels.update({
      userId: "me",
      id: labelId,
      requestBody: updates,
    });

    return response.data as GmailLabel;
  } catch (error: unknown) {
    if (getApiErrorCode(error) === 404) {
      throw new Error(`Label with ID "${labelId}" not found.`);
    }
    throw new Error(`Failed to update label: ${getErrorMessage(error)}`);
  }
}

export async function deleteLabel(
  gmail: gmail_v1.Gmail,
  labelId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const label = await gmail.users.labels.get({
      userId: "me",
      id: labelId,
    });

    if (label.data.type === "system") {
      throw new Error("Cannot delete system label.");
    }

    await gmail.users.labels.delete({ userId: "me", id: labelId });

    return {
      success: true,
      message: `Label "${label.data.name}" deleted successfully.`,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("Cannot delete")) {
      throw error;
    }
    if (getApiErrorCode(error) === 404) {
      throw new Error(`Label with ID "${labelId}" not found.`);
    }
    throw new Error(`Failed to delete label: ${getErrorMessage(error)}`);
  }
}

export async function listLabels(
  gmail: gmail_v1.Gmail
): Promise<LabelListResult> {
  try {
    const response = await gmail.users.labels.list({ userId: "me" });
    const labels = (response.data.labels || []) as GmailLabel[];

    const systemLabels = labels.filter(
      (label) => label.type === "system"
    );
    const userLabels = labels.filter(
      (label) => label.type === "user"
    );

    return {
      all: labels,
      system: systemLabels,
      user: userLabels,
      count: {
        total: labels.length,
        system: systemLabels.length,
        user: userLabels.length,
      },
    };
  } catch (error: unknown) {
    throw new Error(`Failed to list labels: ${getErrorMessage(error)}`);
  }
}

export async function findLabelByName(
  gmail: gmail_v1.Gmail,
  labelName: string
): Promise<GmailLabel | null> {
  try {
    const labelsResponse = await listLabels(gmail);
    return (
      labelsResponse.all.find(
        (label) =>
          label.name.toLowerCase() === labelName.toLowerCase()
      ) || null
    );
  } catch (error: unknown) {
    throw new Error(`Failed to find label: ${getErrorMessage(error)}`);
  }
}

export async function getOrCreateLabel(
  gmail: gmail_v1.Gmail,
  labelName: string,
  options: LabelOptions = {}
): Promise<GmailLabel> {
  try {
    const existingLabel = await findLabelByName(gmail, labelName);
    if (existingLabel) return existingLabel;
    return await createLabel(gmail, labelName, options);
  } catch (error: unknown) {
    throw new Error(
      `Failed to get or create label: ${getErrorMessage(error)}`
    );
  }
}
