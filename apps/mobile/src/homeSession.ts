import type { Home } from './api';

type Snapshot = {
  customerId: string | null;
  home: Home | null;
  refreshing: boolean;
  error: string | null;
};

/** Owns requests for one provider; independent of React and the native view tree. */
export function createHomeSession(fetchHome: (id: string) => Promise<Home>) {
  let snapshot: Snapshot = { customerId: null, home: null, refreshing: false, error: null };
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  let afterAction: Promise<void> | null = null;
  let manual: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const reset = (customerId: string | null) => {
    generation += 1;
    inFlight = afterAction = manual = null;
    update({ customerId, home: null, refreshing: false, error: null });
    return generation;
  };

  // Sharing a request prevents slow polls and pull gestures from overlapping.
  const load = (): Promise<void> => {
    if (!snapshot.customerId) return Promise.resolve();
    if (inFlight) return inFlight;
    const id = snapshot.customerId;
    const owner = generation;
    const request = (async () => {
      try {
        const home = await Promise.resolve().then(() => fetchHome(id));
        if (owner === generation) update({ home, error: null });
      } catch (error) {
        if (owner === generation) update({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (owner === generation) inFlight = null;
      }
    })();
    inFlight = request;
    return request;
  };

  const session = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    signIn: async (id: string): Promise<Home | null> => {
      const owner = reset(id);
      // Sign-in errors still reach the login screen's existing error alert.
      let result: Home | null = null;
      let failure: unknown;
      let failedCurrentSession = false;
      const request = (async () => {
        try {
          const home = await Promise.resolve().then(() => fetchHome(id));
          if (owner === generation) {
            result = home;
            update({ home, error: null });
          }
        } catch (error) {
          failure = error;
          if (owner === generation) {
            failedCurrentSession = true;
            reset(null);
          }
        } finally {
          if (owner === generation) inFlight = null;
        }
      })();
      inFlight = request;
      await request;
      if (failedCurrentSession) throw failure;
      return owner === generation ? result : null;
    },
    signOut: () => { reset(null); },
    refresh: (): Promise<void> => {
      if (!snapshot.customerId) return Promise.resolve();
      if (manual) return manual;
      const owner = generation;
      update({ refreshing: true });
      manual = (async () => {
        try { await (afterAction ?? load()); }
        finally {
          if (owner === generation) {
            manual = null;
            update({ refreshing: false });
          }
        }
      })();
      return manual;
    },
    // A mutation must fetch again even when a pre-mutation request is pending.
    refreshAfterAction: (): Promise<void> => {
      if (!snapshot.customerId) return Promise.resolve();
      const owner = generation;
      const pending = afterAction ?? inFlight;
      const request = Promise.resolve().then(async () => {
        try {
          if (pending) await pending;
          if (owner === generation) await load();
        } finally {
          if (owner === generation && afterAction === request) afterAction = null;
        }
      });
      afterAction = request;
      return request;
    },
    startPolling: () => {
      const timer = setInterval(() => {
        if (snapshot.home && !inFlight && !afterAction) void load();
      }, 6000);
      return () => {
        clearInterval(timer);
        // Any work completing after provider cleanup is obsolete.
        generation += 1;
        inFlight = afterAction = manual = null;
        update({ refreshing: false });
      };
    },
  };
  return session;
}
