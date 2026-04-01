export interface QueueTokenLike {
  status: string;
  tokenNumber: number;
  isPriority?: boolean;
  priorityMarkedAt?: Date | string | null;
}

const STATUS_ORDER: Record<string, number> = {
  'in-progress': 0,
  waiting: 1,
  done: 2,
  cancelled: 3,
};

function getPriorityTime(value: Date | string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

export function sortWaitingByPriority<T extends QueueTokenLike>(tokens: T[]): T[] {
  return [...tokens].sort((a, b) => {
    const aPriority = Boolean(a.isPriority);
    const bPriority = Boolean(b.isPriority);

    if (aPriority !== bPriority) {
      return aPriority ? -1 : 1;
    }

    if (aPriority && bPriority) {
      const priorityDiff = getPriorityTime(a.priorityMarkedAt) - getPriorityTime(b.priorityMarkedAt);
      if (priorityDiff !== 0) return priorityDiff;
    }

    return a.tokenNumber - b.tokenNumber;
  });
}

export function sortQueueForDoctor<T extends QueueTokenLike>(tokens: T[]): T[] {
  return [...tokens].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    if (a.status === 'waiting' && b.status === 'waiting') {
      const aPriority = Boolean(a.isPriority);
      const bPriority = Boolean(b.isPriority);

      if (aPriority !== bPriority) {
        return aPriority ? -1 : 1;
      }

      if (aPriority && bPriority) {
        const priorityDiff = getPriorityTime(a.priorityMarkedAt) - getPriorityTime(b.priorityMarkedAt);
        if (priorityDiff !== 0) return priorityDiff;
      }
    }

    return a.tokenNumber - b.tokenNumber;
  });
}
