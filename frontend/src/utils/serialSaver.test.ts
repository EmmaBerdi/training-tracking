import { describe, expect, it, vi } from 'vitest';
import { createSerialSaver } from './serialSaver';

/** A save whose calls stay in flight until the test settles them. */
function controlledSave() {
  const calls: { value: string; settle: (ok: boolean) => void; fail: (err: Error) => void }[] = [];
  const save = vi.fn(
    (value: string) =>
      new Promise<boolean>((resolve, reject) => {
        calls.push({ value, settle: resolve, fail: reject });
      }),
  );
  return { save, calls };
}

/** Lets the saver's awaits run after a call was settled. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('createSerialSaver', () => {
  it('starts saving right away when idle', () => {
    const { save } = controlledSave();
    const schedule = createSerialSaver(save, vi.fn());

    schedule('a');

    expect(save).toHaveBeenCalledWith('a');
  });

  it('never runs two saves at once', async () => {
    const { save, calls } = controlledSave();
    const schedule = createSerialSaver(save, vi.fn());

    schedule('a');
    schedule('b');
    expect(save).toHaveBeenCalledTimes(1);

    calls[0].settle(true);
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1].value).toBe('b');
  });

  it('sends only the newest state that arrived during a save, and sends it last', async () => {
    const { save, calls } = controlledSave();
    const schedule = createSerialSaver(save, vi.fn());

    schedule('a');
    schedule('b');
    schedule('c');
    schedule('d');
    calls[0].settle(true);
    await flush();
    calls[1].settle(true);
    await flush();

    expect(calls.map((c) => c.value)).toEqual(['a', 'd']);
  });

  it('reports a failed save and still sends the newer state', async () => {
    const { save, calls } = controlledSave();
    const onFail = vi.fn();
    const schedule = createSerialSaver(save, onFail);

    schedule('a');
    schedule('b');
    calls[0].settle(false);
    await flush();

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.value)).toEqual(['a', 'b']);
  });

  it('treats a throwing save as failed instead of getting stuck', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { save, calls } = controlledSave();
    const onFail = vi.fn();
    const schedule = createSerialSaver(save, onFail);

    schedule('a');
    schedule('b');
    calls[0].fail(new Error('boom'));
    await flush();

    expect(onFail).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.value)).toEqual(['a', 'b']);
  });

  it('is idle again once everything is saved', async () => {
    const { save, calls } = controlledSave();
    const schedule = createSerialSaver(save, vi.fn());

    schedule('a');
    calls[0].settle(true);
    await flush();
    schedule('b');

    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1].value).toBe('b');
  });
});
