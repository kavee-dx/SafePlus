export interface AlertSmsMessage {
  id: string;
  warningId: string;
  senderId: string;
  levelLabel: string;
  areaLabel: string;
  instruction: string;
  body: string;
  deliveredAt: Date;
  readAt?: Date;
  /** Copied from the warning so a stood-down alert stops looking live. */
  warningStatus: string;
  hazardType: string;
  severityLevel: string;
  targetDistrict: string;
  expiresAt?: Date;
}

export interface AlertSmsInbox {
  messages: AlertSmsMessage[];
  unreadCount: number;
}

export interface NewAlertSms {
  warningInternalId: string;
  recipientId: string;
  senderId: string;
  levelLabel: string;
  areaLabel: string;
  instruction: string;
  body: string;
}
