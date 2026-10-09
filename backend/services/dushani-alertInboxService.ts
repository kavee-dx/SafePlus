import { ApiError } from "../utils/apiError";
import {
  listAlertSms,
  markAlertSmsRead,
} from "../repositories/dushani-alertSmsRepository";
import type { AlertSmsInbox } from "../models/alertSms";

/**
 * Read side of the SMS channel: what the citizen's handset actually holds.
 */
export class AlertInboxService {
  async getInbox(recipientId: string): Promise<AlertSmsInbox> {
    const messages = await listAlertSms(recipientId);

    return {
      messages,
      unreadCount: messages.filter((message) => !message.readAt).length,
    };
  }

  async markAsRead(messageId: string, recipientId: string): Promise<void> {
    const owned = await markAlertSmsRead(messageId, recipientId);

    if (!owned) {
      throw new ApiError(404, "That alert is not in your inbox.");
    }
  }
}

let alertInboxService: AlertInboxService | null = null;

export function getAlertInboxService(): AlertInboxService {
  if (!alertInboxService) {
    alertInboxService = new AlertInboxService();
  }

  return alertInboxService;
}
