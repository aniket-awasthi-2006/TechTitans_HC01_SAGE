// Wait time calculation engine
// Formula: EWT = avgConsultationTime × patientsAhead

export const DEFAULT_AVG_CONSULTATION_MINUTES = 10; // fallback

export function calculateWaitTime(
  patientsAhead: number,
  avgConsultationMinutes: number = DEFAULT_AVG_CONSULTATION_MINUTES
): number {
  return Math.max(0, patientsAhead * avgConsultationMinutes);
}

export function formatWaitTime(minutes: number): string {
  if (minutes === 0) return "You're next!";
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
}

export function calculateAvgConsultationTime(durations: number[]): number {
  if (durations.length === 0) return DEFAULT_AVG_CONSULTATION_MINUTES;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(avg);
}

export function getQueuePosition(
  tokenId: string,
  queue: Array<{ _id: string; status: string }>
): number {
  const waitingQueue = queue.filter((t) => t.status === 'waiting');
  const index = waitingQueue.findIndex((t) => t._id.toString() === tokenId);
  return index === -1 ? -1 : index;
}
