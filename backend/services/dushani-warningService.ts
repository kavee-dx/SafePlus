import { v4 as uuidv4 } from "uuid";

import { ApiError } from "../utils/apiError";
import {
  NotificationType,
  ReportStatus,
  type HazardReport,
} from "../models/hazardReport";
import {
  BoundarySource,
  ChannelType,
  DEFAULT_WARNING_LIFETIME_HOURS,
  WarningStatus,
  type AudiencePreview,
  type Coordinate,
  type CreateDraftRequest,
  type DisasterWarning,
} from "../models/disasterWarning";
import {
  changeStatus,
  deleteDraft as deleteDraftRow,
  deleteIssuedWarning as deleteIssuedWarningRow,
  expireOverdueWarnings,
  extendExpiry as extendExpiryRow,
  findAlertAudience,
  findWarningByPublicId,
  insertBroadcastLogs,
  insertWarning,
  listWarningsByOfficer,
  listWarningsByReport,
  markBroadcast,
  updateWarning,
  type AudienceRow,
} from "../repositories/dushani-warningRepository";
import {
  findReportById,
  findReportByPublicId,
  findVerificationRecipients,
  insertNotifications,
} from "../repositories/dushani-hazardReportRepository";
import { insertAlertSms } from "../repositories/dushani-alertSmsRepository";
import type { NewAlertSms } from "../models/alertSms";

import { getDistrictBoundaryService } from "./dushani-districtBoundaryService";
import { getOfficerPinService } from "./dushani-officerPinService";
import {
  ChannelDispatcher,
  PushAlertChannel,
  SirenRelayAdapter,
  type AlertRecipient,
} from "./dushani-disseminationChannels";
import {
  SmsAlertChannel,
  alertLevelLabel,
  defaultInstruction,
  smsSenderId,
} from "./dushani-smsGatewayService";
import { getAuditLogger } from "./dushani-auditLoggerService";

const boundaries = getDistrictBoundaryService();
const pinService = getOfficerPinService();
const auditLogger = getAuditLogger();

interface ResolvedTarget {
  source: BoundarySource;
  coordinates: Coordinate[];
  areaSqKm: number;
  overlapRatio: number;
}

interface ResolvedAudience {
  recipients: AlertRecipient[];
  registeredResidents: number;
  pushCapable: number;
  smsCapable: number;
  outsideBoundary: number;
  audienceCount: number;
  estimatedReach: number;
}

/**
 * The warning half of UC-01.
 *
 * Improvements carried over from the review of the original design:
 * - a warning can only be raised on a VERIFIED ground report (precondition);
 * - the target area is one concept: the district dropdown and the map are both
 *   driven by the same boundary asset and the server refuses a polygon that
 *   leaves the selected district (E2);
 * - the audience is resolved from real registered accounts before anything is
 *   sent, so a district with no coverage is blocked instead of reporting a
 *   fake success;
 * - channels are dispatched concurrently and each failure is contained (A1/E1);
 * - audit writes happen off the request path.
 */
export class WarningService {
  private dispatcher: ChannelDispatcher;

  constructor(dispatcher = createDispatcher()) {
    this.dispatcher = dispatcher;
  }

  /**
   * Step 3 to 5: save the officer's work as a draft so a dropped session
   * does not cost them the warning.
   */
  async createDraft(
    officerId: string,
    data: CreateDraftRequest
  ): Promise<DisasterWarning> {
    const report = await this.requireVerifiedReport(data.reportId);

    const raised = await listWarningsByReport(report.id);

    if (raised.length > 0) {
      const existing = raised[0];

      throw new ApiError(
        409,
        `Report ${report.reportId} already raised ${existing.warningId} (${existing.status.replace(/_/g, " ").toLowerCase()}). One report can carry one warning only - reopen it from Alert history, or verify a fresh ground report to alert again.`,
        { reportId: "This report already has a warning." }
      );
    }

    if (!boundaries.hasDistrict(data.targetDistrict)) {
      throw new ApiError(400, "Choose a real Sri Lankan district.", {
        targetDistrict: "Unknown district.",
      });
    }

    const target = this.resolveTarget(data.targetDistrict, data.customBoundary);
    const warningId = generateWarningId();

    const warning = await insertWarning(warningId, officerId, report.id, data, {
      coordinates: target.coordinates,
      areaSqKm: target.areaSqKm,
      overlapRatio: target.overlapRatio,
      source: target.source,
    });

    auditLogger.log({
      warningId,
      officerId,
      action: "DRAFT_CREATED",
      entryPoint: "CREATE_DRAFT",
      details: {
        reportId: report.reportId,
        district: data.targetDistrict,
        boundarySource: target.source,
        areaSqKm: target.areaSqKm,
      },
    });

    return warning;
  }

  async updateDraft(
    publicWarningId: string,
    officerId: string,
    data: Partial<CreateDraftRequest>
  ): Promise<DisasterWarning> {
    const warning = await this.requireOwnedDraft(publicWarningId, officerId);

    if (data.targetDistrict && !boundaries.hasDistrict(data.targetDistrict)) {
      throw new ApiError(400, "Choose a real Sri Lankan district.", {
        targetDistrict: "Unknown district.",
      });
    }

    const district = data.targetDistrict ?? warning.targetDistrict;
    const target =
      data.customBoundary && data.customBoundary.length > 0
        ? this.resolveTarget(district, data.customBoundary)
        : data.targetDistrict && data.targetDistrict !== warning.targetDistrict
          ? this.resolveTarget(district, undefined)
          : null;

    const updated = await updateWarning(
      warning.id,
      officerId,
      { ...data, targetDistrict: district },
      target
        ? {
            coordinates: target.coordinates,
            areaSqKm: target.areaSqKm,
            overlapRatio: target.overlapRatio,
            source: target.source,
          }
        : undefined
    );

    if (!updated) {
      throw new ApiError(409, "Only your own drafts can be edited.");
    }

    auditLogger.log({
      warningId: updated.warningId,
      officerId,
      action: "DRAFT_UPDATED",
      entryPoint: "UPDATE_DRAFT",
    });

    return updated;
  }

  async deleteDraft(publicWarningId: string, officerId: string): Promise<void> {
    const warning = await this.requireOwnedDraft(publicWarningId, officerId);
    const deleted = await deleteDraftRow(warning.id, officerId);

    if (!deleted) {
      throw new ApiError(409, "Only drafts can be discarded.");
    }

    auditLogger.log({
      warningId: warning.warningId,
      officerId,
      action: "DRAFT_DELETED",
      entryPoint: "DELETE_DRAFT",
    });
  }

  /**
   * Delete an issued warning (ACTIVE, EXPIRED, or STOOD_DOWN) by the issuing officer.
   */
  async deleteIssuedWarning(publicWarningId: string, officerId: string): Promise<void> {
    const warning = await this.requireWarning(publicWarningId);

    if (warning.officerId !== officerId) {
      throw new ApiError(403, "Only the issuing officer can delete a warning.");
    }

    if (warning.status !== WarningStatus.ACTIVE && warning.status !== WarningStatus.EXPIRED && warning.status !== WarningStatus.STOOD_DOWN) {
      throw new ApiError(409, "Only issued warnings can be deleted.");
    }

    const deleted = await deleteIssuedWarningRow(warning.id, officerId);

    if (!deleted) {
      throw new ApiError(409, "This warning could not be deleted.");
    }

    auditLogger.log({
      warningId: warning.warningId,
      officerId,
      action: "WARNING_DELETED",
      entryPoint: "DELETE_WARNING",
    });
  }

  /**
   * Step 4: "who actually gets this?" answered before, not after, the broadcast.
   */
  async previewAudience(
    targetDistrict: string,
    customBoundary?: Coordinate[]
  ): Promise<AudiencePreview> {
    if (!boundaries.hasDistrict(targetDistrict)) {
      throw new ApiError(400, "Choose a real Sri Lankan district.", {
        targetDistrict: "Unknown district.",
      });
    }

    const target = this.resolveTarget(targetDistrict, customBoundary);
    const audience = this.toAudience(
      await findAlertAudience(targetDistrict),
      target
    );

    return {
      targetDistrict,
      registeredResidents: audience.registeredResidents,
      pushCapable: audience.pushCapable,
      smsCapable: audience.smsCapable,
      outsideBoundary: audience.outsideBoundary,
      audienceCount: audience.audienceCount,
      hasCustomBoundary: target.source === BoundarySource.CUSTOM,
      canBroadcast: audience.audienceCount > 0,
    };
  }

  /**
   * Step 6: PIN authorization, then dispatch.
   */
  async broadcast(
    officerId: string,
    warningId: string,
    securityPin: string
  ): Promise<DisasterWarning> {
    const pinAuthorized = await this.authorize(officerId, warningId, securityPin);

    if (!pinAuthorized) {
      await auditLogger.logImmediate({
        warningId,
        officerId,
        action: "AUTH_FAILED",
        entryPoint: "BROADCAST",
        details: { reason: "INVALID_CLEARANCE_PIN" },
      });

      throw new ApiError(401, "Invalid Authorization PIN.");
    }

    const warning = await this.requireOwnedDraft(warningId, officerId);
    const report = await this.requireVerifiedReportByInternalId(warning.reportId);

    const target = this.targetFromWarning(warning);
    const audience = this.toAudience(
      await findAlertAudience(warning.targetDistrict),
      target
    );

    if (audience.audienceCount === 0) {
      await this.recordFailure(officerId, warningId, "NO_COVERAGE", {
        district: warning.targetDistrict,
        registeredResidents: audience.registeredResidents,
      });

      throw new ApiError(
        422,
        `No Coverage: no alerted accounts are registered in ${warning.targetDistrict} District. Widen the target area or use the siren channel.`
      );
    }

    const lifetimeHours =
      warning.expiresInHours ?? DEFAULT_WARNING_LIFETIME_HOURS;
    const issuedAt = new Date();
    const expiresAt = new Date(Date.now() + lifetimeHours * 3_600_000);

    // Update warning messages to include issued and expiry times
    const messagesWithTime = this.synthesizeMessages(
      warning.hazardType,
      warning.severityLevel,
      warning.targetDistrict,
      warning.safetyInstructions,
      issuedAt,
      expiresAt
    );

    const dispatched = await markBroadcast(
      warning.id,
      {
        audienceCount: audience.audienceCount,
        smsRecipientCount: audience.smsCapable,
        estimatedReach: audience.estimatedReach,
      },
      expiresAt,
      messagesWithTime
    );

    if (!dispatched) {
      throw new ApiError(409, "This warning changed while you were authorizing it.");
    }

    const selected = selectedChannels(dispatched);
    const outcome = await this.dispatcher.dispatch(
      dispatched,
      selected,
      audience.recipients
    );

    // Seed the handsets first: this store is what the citizen app reads, so a
    // bookkeeping failure below must never leave a broadcast invisible.
    const inboxRows = await this.storeInInbox(
      dispatched,
      audience.recipients,
      messagesWithTime
    );

    await insertBroadcastLogs(
      dispatched.id,
      [...outcome.results.entries()].map(([channelType, result]) => ({
        channelType,
        status: result.status,
        targetCount: result.targetCount,
        deliveryCount: result.deliveryCount,
        failureCount: result.failureCount,
        errorMessage: result.errorMessage,
      }))
    );

    if (outcome.smsFallbackTriggered) {
      auditLogger.log({
        warningId: dispatched.warningId,
        officerId,
        action: "SMS_FALLBACK",
        entryPoint: "BROADCAST",
        details: { pushReceiptRatio: outcome.pushReceiptRatio },
      });
    }

    const delivered = [...outcome.results.values()].reduce(
      (total, result) => total + result.deliveryCount,
      0
    );

    auditLogger.log({
      warningId: dispatched.warningId,
      officerId,
      action: "BROADCAST_SUCCESS",
      entryPoint: "BROADCAST",
      details: {
        reportId: report.reportId,
        district: dispatched.targetDistrict,
        audienceCount: audience.audienceCount,
        delivered,
        inboxRows,
        channels: [...outcome.results.keys()],
        sirenAutoIncluded: selected.includes(ChannelType.SIREN) && !dispatched.channels.siren,
      },
    });

    await this.notifyOfficers(dispatched, report);

    const hydrated = await findWarningByPublicId(dispatched.warningId);

    if (!hydrated) {
      throw new ApiError(500, "Warning dispatch recorded but the warning is missing.");
    }

    return hydrated;
  }

  /**
   * Telemetry stand-down: a live warning must be closable, otherwise the
   * officer has no way to stop a stale alert. Needs the same clearance PIN as
   * the broadcast that put it on the handsets.
   */
  async standDown(
    officerId: string,
    warningId: string,
    securityPin: string
  ): Promise<DisasterWarning> {
    const pinAuthorized = await this.authorize(officerId, warningId, securityPin, "STAND_DOWN");

    if (!pinAuthorized) {
      await auditLogger.logImmediate({
        warningId,
        officerId,
        action: "AUTH_FAILED",
        entryPoint: "STAND_DOWN",
        details: { reason: "INVALID_CLEARANCE_PIN" },
      });

      throw new ApiError(401, "Invalid Authorization PIN.");
    }

    const warning = await this.requireWarning(warningId);

    if (warning.officerId !== officerId) {
      throw new ApiError(403, "Only the issuing officer can stand a warning down.");
    }

    if (
      warning.status !== WarningStatus.ACTIVE &&
      warning.status !== WarningStatus.EXPIRED
    ) {
      throw new ApiError(409, "Only a broadcast warning can be stood down.");
    }

    const updated = await changeStatus(warning.id, WarningStatus.STOOD_DOWN);

    auditLogger.log({
      warningId,
      officerId,
      action: "STOOD_DOWN",
      entryPoint: "TELEMETRY",
    });

    if (!updated) {
      throw new ApiError(409, "This warning can no longer be stood down.");
    }

    return updated;
  }

  /**
   * The danger has not always passed when the officer's first guess at a
   * lifetime runs out, so a live warning must be extendable. Extending also
   * revives one that lapsed minutes ago. Requires PIN authorization.
   */
  async extendExpiry(
    officerId: string,
    warningId: string,
    extendByHours: number,
    securityPin: string
  ): Promise<DisasterWarning> {
    const pinAuthorized = await this.authorize(
      officerId,
      warningId,
      securityPin,
      "EXTEND_EXPIRY"
    );

    if (!pinAuthorized) {
      await auditLogger.logImmediate({
        warningId,
        officerId,
        action: "AUTH_FAILED",
        entryPoint: "EXTEND_EXPIRY",
        details: { reason: "INVALID_CLEARANCE_PIN" },
      });

      throw new ApiError(401, "Invalid Authorization PIN.");
    }

    const warning = await this.requireWarning(warningId);

    if (warning.officerId !== officerId) {
      throw new ApiError(403, "Only the issuing officer can extend a warning.");
    }

    if (warning.status !== WarningStatus.ACTIVE && warning.status !== WarningStatus.EXPIRED) {
      throw new ApiError(409, "Only a broadcast warning can be extended.");
    }

    const updated = await extendExpiryRow(warning.id, officerId, extendByHours);

    if (!updated) {
      throw new ApiError(409, "This warning can no longer be extended.");
    }

    auditLogger.log({
      warningId,
      officerId,
      action: "EXPIRY_EXTENDED",
      entryPoint: "TELEMETRY",
      details: {
        extendByHours,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
      },
    });

    return updated;
  }

  async getWarning(warningId: string): Promise<DisasterWarning | null> {
    await expireOverdueWarnings();

    return findWarningByPublicId(warningId);
  }

  async getWarningsByOfficer(officerId: string): Promise<DisasterWarning[]> {
    await expireOverdueWarnings();

    return listWarningsByOfficer(officerId);
  }

  /**
   * Payload preview helper: builds the trilingual text the officer then edits.
   * Now includes issued time and expiry time.
   */
  synthesizeMessages(
    hazardType: string,
    severityLevel: string,
    targetDistrict: string,
    safetyInstructions?: string,
    issuedAt?: Date,
    expiresAt?: Date
  ): { english: string; sinhala: string; tamil: string } {
    const label = severityLabel(severityLevel);
    const readable = hazardType.replace(/_/g, " ").toLowerCase();
    const instruction = safetyInstructions?.trim() || defaultInstruction(severityLevel);

    const issuedStr = issuedAt ? issuedAt.toLocaleString() : "";
    const expiryStr = expiresAt ? expiresAt.toLocaleString() : "";

    return {
      english: `SAFEPLUS ALERT: ${label} - ${readable} in ${targetDistrict} District. ${instruction} Issued: ${issuedStr}. Expires: ${expiryStr}`,
      sinhala: `සේෆ්ප්ලස් අනතුරු ඇඟවීම: ${targetDistrict} දිස්ත්‍රික්කයේ ${readable} - ${label}. ${instruction} නිකුත් කළ: ${issuedStr}. කල් ඉකුත් වන: ${expiryStr}`,
      tamil: `SAFEPlus எச்சரிக்கை: ${targetDistrict} மாவட்டத்தில் ${readable} - ${label}. ${instruction} வெளியிடப்பட்டது: ${issuedStr}. காலாவதி: ${expiryStr}`,
    };
  }

  private async authorize(
    officerId: string,
    warningId: string,
    securityPin: string,
    entryPoint = "BROADCAST"
  ): Promise<boolean> {
    try {
      return await pinService.verify(officerId, securityPin);
    } catch (error) {
      if (error instanceof ApiError && error.status === 428) {
        await auditLogger.logImmediate({
          warningId,
          officerId,
          action: "AUTH_FAILED",
          entryPoint,
          details: { reason: "CLEARANCE_PIN_NOT_CONFIGURED" },
        });
      }

      throw error;
    }
  }

  private async recordFailure(
    officerId: string,
    warningId: string,
    action: "NO_COVERAGE" | "BROADCAST_FAILED",
    details: Record<string, unknown>
  ): Promise<void> {
    await auditLogger.logImmediate({
      warningId,
      officerId,
      action,
      entryPoint: "BROADCAST",
      details,
    });
  }

  /**
   * The wizard sends the human readable RPT-... id; the API resolves it here.
   */
  private async requireVerifiedReport(reportId: string): Promise<HazardReport> {
    return this.assertVerified(await findReportByPublicId(reportId));
  }

  /**
   * `disaster_warnings.report_id` holds the internal uuid, so a warning that is
   * already persisted must be re-checked by that id instead.
   */
  private async requireVerifiedReportByInternalId(
    id: string
  ): Promise<HazardReport> {
    return this.assertVerified(await findReportById(id));
  }

  private assertVerified(report: HazardReport | null): HazardReport {
    if (!report) {
      throw new ApiError(404, "Select the verified hazard report first.", {
        reportId: "Unknown hazard report.",
      });
    }

    if (report.status !== ReportStatus.VERIFIED) {
      throw new ApiError(
        409,
        `Report ${report.reportId} is ${report.status.replace(/_/g, " ").toLowerCase()}. A warning needs a VERIFIED ground report.`
      );
    }

    return report;
  }

  private async requireWarning(warningId: string): Promise<DisasterWarning> {
    const warning = await findWarningByPublicId(warningId);

    if (!warning) {
      throw new ApiError(404, "Warning not found.");
    }

    return warning;
  }

  private async requireOwnedDraft(
    warningId: string,
    officerId: string
  ): Promise<DisasterWarning> {
    const warning = await this.requireWarning(warningId);

    if (warning.officerId !== officerId) {
      throw new ApiError(403, "This warning belongs to another officer.");
    }

    if (warning.status !== WarningStatus.DRAFT) {
      throw new ApiError(
        409,
        `Only drafts can be changed. This warning is ${warning.status.replace(/_/g, " ").toLowerCase()}.`
      );
    }

    return warning;
  }

  /**
   * District choice and drawn shape become one answer here. A shape that
   * leaves the district is refused, which is what stops the dropdown and the
   * map from ever disagreeing.
   */
  private resolveTarget(
    district: string,
    customBoundary?: Coordinate[]
  ): ResolvedTarget {
    if (!customBoundary || customBoundary.length === 0) {
      const polygon = boundaries.districtPolygon(district) ?? [];

      return {
        source: BoundarySource.DISTRICT,
        coordinates: polygon,
        areaSqKm: boundaries.getBoundary(district)?.areaSqKm ?? 0,
        overlapRatio: 1,
      };
    }

    const analysis = boundaries.analyzeBoundary(district, customBoundary);

    if (!analysis.isValid) {
      throw new ApiError(400, analysis.error ?? "The drawn boundary is not valid.", {
        customBoundary: analysis.error ?? "Invalid boundary.",
      });
    }

    return {
      source: BoundarySource.CUSTOM,
      coordinates: customBoundary,
      areaSqKm: analysis.areaSqKm,
      overlapRatio: analysis.overlapRatio,
    };
  }

  private targetFromWarning(warning: DisasterWarning): ResolvedTarget {
    const polygon = warning.gisPolygon;

    if (polygon && polygon.coordinates.length > 0) {
      return {
        source: polygon.source,
        coordinates: polygon.coordinates,
        areaSqKm: polygon.areaSqKm,
        overlapRatio: polygon.districtOverlapRatio ?? 1,
      };
    }

    return this.resolveTarget(warning.targetDistrict, undefined);
  }

  private toAudience(
    rows: AudienceRow[],
    target: ResolvedTarget
  ): ResolvedAudience {
    const inside = (row: AudienceRow): boolean => {
      if (target.source !== BoundarySource.CUSTOM) {
        return true;
      }

      if (row.latitude === undefined || row.longitude === undefined) {
        // No fix on file: trust the district they registered in.
        return true;
      }

      return boundaries.containsPoint(target.coordinates, {
        lat: row.latitude,
        lng: row.longitude,
      });
    };

    const recipients = rows.filter(inside);
    const pushCapable = recipients.filter((row) => Boolean(row.deviceToken)).length;
    const smsCapable = recipients.filter((row) => Boolean(row.phoneNumber)).length;
    const audienceCount = recipients.length;
    const estimatedReach =
      rows.length === 0
        ? 0
        : Number(((audienceCount / rows.length) * 100).toFixed(2));

    return {
      recipients: recipients.map((row) => ({
        userId: row.userId,
        phoneNumber: row.phoneNumber,
        deviceToken: row.deviceToken,
      })),
      registeredResidents: rows.length,
      pushCapable,
      smsCapable,
      outsideBoundary: rows.length - audienceCount,
      audienceCount,
      estimatedReach,
    };
  }

  /**
   * The citizen app reads its alerts from this store rather than from the push
   * socket, so a broadcast that is not written here is invisible on the
   * handset even when the channel reports it as sent. Runs after dispatch:
   * the SMS channel seeds the rows it owns, and this tops the cohort up.
   */
  private async storeInInbox(
    warning: DisasterWarning,
    recipients: AlertRecipient[],
    messages: { english: string; sinhala: string; tamil: string }
  ): Promise<number> {
    const body = [messages.english, messages.sinhala, messages.tamil]
      .map((text) => text.trim())
      .filter(Boolean)
      .join(" | ");

    return insertAlertSms(
      recipients.map<NewAlertSms>((recipient) => ({
        warningInternalId: warning.id,
        recipientId: recipient.userId,
        senderId: smsSenderId(),
        levelLabel: alertLevelLabel(warning.severityLevel),
        areaLabel: `${warning.targetDistrict} District`,
        instruction:
          warning.safetyInstructions?.trim() ||
          defaultInstruction(warning.severityLevel),
        body,
      }))
    );
  }

  private async notifyOfficers(
    warning: DisasterWarning,
    report: HazardReport
  ): Promise<void> {
    const recipients = await findVerificationRecipients(warning.targetDistrict);

    await insertNotifications(
      recipients
        .filter((recipientId) => recipientId !== warning.officerId)
        .map((recipientId) => ({
          recipientId,
          type: NotificationType.WARNING_CREATED,
          title: `Warning issued: ${warning.severityLevel} ${warning.hazardType} in ${warning.targetDistrict}`,
          message: `${warning.warningId} reached ${warning.audienceCount} alerted accounts. Report ${report.reportId}.`,
          relatedReportId: report.id,
          relatedWarningId: warning.id,
        }))
    );
  }
}

function createDispatcher(): ChannelDispatcher {
  const dispatcher = new ChannelDispatcher();

  dispatcher.registerChannel(new PushAlertChannel());
  dispatcher.registerChannel(new SmsAlertChannel());
  dispatcher.registerChannel(new SirenRelayAdapter());

  return dispatcher;
}

function selectedChannels(warning: DisasterWarning): ChannelType[] {
  const selected: ChannelType[] = [];

  if (warning.channels.push) selected.push(ChannelType.PUSH);
  if (warning.channels.sms) selected.push(ChannelType.SMS);

  // A1: a critical event raises the sirens even when the officer forgot to tick
  // the channel, because the coastal and dam-breach alerts depend on them.
  if (warning.channels.siren || warning.severityLevel === "CRITICAL") {
    selected.push(ChannelType.SIREN);
  }

  return selected;
}

function severityLabel(severityLevel: string): string {
  const labels: Record<string, string> = {
    LOW: "Advisory",
    MEDIUM: "Watch",
    HIGH: "Warning",
    CRITICAL: "Evacuate now",
  };

  return labels[severityLevel] ?? severityLevel;
}

function generateWarningId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().slice(0, 4).toUpperCase();

  return `WARN-${timestamp}-${random}`;
}

let warningService: WarningService | null = null;

export function getWarningService(): WarningService {
  if (!warningService) {
    warningService = new WarningService();
  }

  return warningService;
}


