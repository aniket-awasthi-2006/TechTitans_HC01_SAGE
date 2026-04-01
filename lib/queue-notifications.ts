import Consultation from '@/models/Consultation';
import Token from '@/models/Token';
import User from '@/models/User';
import { sendFcmMulticast, isFcmAdminConfigured } from '@/lib/fcm-admin';
import { sortWaitingByPriority } from '@/lib/queue-sort';

const WAIT_ALERT_MINUTES = 15;
const WAIT_ALERT_MAX_MINUTES = 20;
const DEFAULT_AVG_MINUTES = 10;

function toIdString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    const objectWithId = value as { _id?: unknown };
    if (objectWithId._id) return String(objectWithId._id);
  }
  return String(value);
}

function getRecipientUserIds(token: { patientId?: unknown; bookedById?: unknown }) {
  const ids = [toIdString(token.patientId), toIdString(token.bookedById)].filter(Boolean) as string[];
  return Array.from(new Set(ids));
}

async function getFcmTokensForUsers(userIds: string[]) {
  if (userIds.length === 0) return [];
  const users = await User.find({ _id: { $in: userIds } }, { fcmTokens: 1 }).lean();
  const tokens = users.flatMap((u) => (Array.isArray(u.fcmTokens) ? u.fcmTokens : []));
  return Array.from(new Set(tokens));
}

async function sendToUsers(userIds: string[], payload: { title: string; body: string; data?: Record<string, string> }) {
  if (!isFcmAdminConfigured()) return;
  const fcmTokens = await getFcmTokensForUsers(userIds);
  if (fcmTokens.length === 0) return;

  const result = await sendFcmMulticast(fcmTokens, payload);
  if (result.invalidTokens.length > 0) {
    await User.updateMany(
      { fcmTokens: { $in: result.invalidTokens } },
      { $pull: { fcmTokens: { $in: result.invalidTokens } } }
    );
  }
}

async function getAverageDurationForDoctor(date: string, doctorId: string) {
  const consultations = await Consultation.find(
    { date, doctorId },
    { duration: 1 }
  ).lean();

  const durations = consultations
    .map((c) => Number(c.duration))
    .filter((d) => Number.isFinite(d) && d > 0);

  if (durations.length === 0) return DEFAULT_AVG_MINUTES;
  return Math.max(1, Math.round(durations.reduce((a, b) => a + b, 0) / durations.length));
}

export async function sendWaitWindowNotifications(date: string, doctorId: string) {
  if (!isFcmAdminConfigured()) return;

  const waitingRaw = await Token.find(
    { date, doctorId, status: 'waiting' },
    { patientName: 1, patientId: 1, bookedById: 1, tokenNumber: 1, isPriority: 1, priorityMarkedAt: 1, waitWindowAlertSentAt: 1 }
  ).lean();

  if (waitingRaw.length === 0) return;

  const waiting = sortWaitingByPriority(waitingRaw);
  const avgMinutes = await getAverageDurationForDoctor(date, doctorId);

  for (let index = 0; index < waiting.length; index += 1) {
    const queueToken = waiting[index] as (typeof waiting)[number] & { waitWindowAlertSentAt?: Date };
    const estimatedWait = index * avgMinutes;

    if (estimatedWait < WAIT_ALERT_MINUTES || estimatedWait > WAIT_ALERT_MAX_MINUTES) continue;
    if (queueToken.waitWindowAlertSentAt) continue;

    const recipients = getRecipientUserIds(queueToken);
    if (recipients.length === 0) continue;

    await sendToUsers(recipients, {
      title: 'MediQueue Reminder',
      body: `${queueToken.patientName} may be called in about ${estimatedWait} minutes. Please reach on time.`,
      data: {
        type: 'wait-window',
        tokenId: String(queueToken._id),
        waitMinutes: String(estimatedWait),
        link: '/patient/dashboard',
      },
    });

    await Token.updateOne(
      { _id: queueToken._id },
      { $set: { waitWindowAlertSentAt: new Date() } }
    );
  }
}

type CancellationNotificationInput = {
  actorRole: 'patient' | 'reception' | 'doctor';
  date: string;
  doctorId: string;
  previousStatus: string;
  token: {
    _id: string;
    patientName: string;
    patientId?: unknown;
    bookedById?: unknown;
  };
};

export async function sendCancellationNotifications(input: CancellationNotificationInput) {
  if (!isFcmAdminConfigured()) return;

  const { actorRole, date, doctorId, previousStatus, token } = input;
  const isMarkedMissing = actorRole === 'doctor' || previousStatus === 'in-progress';
  const statusText = isMarkedMissing ? 'marked absent/missed' : 'cancelled';

  const affectedWaiting = await Token.find(
    { date, doctorId, status: 'waiting', _id: { $ne: token._id } },
    { patientId: 1, bookedById: 1 }
  ).lean();

  const waitingRecipients = Array.from(
    new Set(affectedWaiting.flatMap((item) => getRecipientUserIds(item)))
  );

  if (waitingRecipients.length > 0) {
    await sendToUsers(waitingRecipients, {
      title: 'Queue Updated',
      body: `${token.patientName} was ${statusText}. Your waiting time may be reduced.`,
      data: {
        type: 'queue-update',
        tokenId: token._id,
        link: '/patient/dashboard',
      },
    });
  }

  if (actorRole !== 'patient') {
    const ownerRecipients = getRecipientUserIds(token);
    if (ownerRecipients.length > 0) {
      await sendToUsers(ownerRecipients, {
        title: 'Queue Status Changed',
        body: `${token.patientName} token has been ${statusText}. Please contact reception for assistance.`,
        data: {
          type: 'token-cancelled',
          tokenId: token._id,
          link: '/patient/dashboard',
        },
      });
    }
  }
}
