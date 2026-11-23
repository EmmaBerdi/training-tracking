/**
 * Runs one save at a time. Edits that arrive meanwhile only replace the pending state: every save
 * sends the whole state, so sending the newest is enough, and saves can't finish out of order.
 */
export function createSerialSaver<T>(
  save: (value: T) => Promise<boolean>,
  onFail: () => void,
): (value: T) => void {
  let running = false;
  let pending: { value: T } | null = null;

  async function drain() {
    running = true;
    while (pending) {
      const { value } = pending;
      pending = null;
      // A throw counts as a failed save, so it can't leave the saver stuck or drop a newer state.
      const ok = await save(value).catch((err: unknown) => {
        console.error(err);
        return false;
      });
      if (!ok) onFail();
    }
    running = false;
  }

  return (value) => {
    pending = { value };
    if (!running) void drain();
  };
}
