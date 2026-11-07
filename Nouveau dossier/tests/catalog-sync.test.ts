import { test } from "node:test";
import assert from "node:assert/strict";
import {
  watchCatalogActivity,
  type CatalogActivityEnvironment,
} from "../src/catalogSync.ts";

class Events {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, callback: () => void) {
    const set = this.listeners.get(type) || new Set();
    set.add(callback);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, callback: () => void) {
    this.listeners.get(type)?.delete(callback);
  }
  fire(type: string) {
    for (const callback of this.listeners.get(type) || []) callback();
  }
  get count() {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function fixture() {
  let now = 0;
  const window = new Events(),
    document = Object.assign(new Events(), { visibilityState: "visible" }),
    navigator = { onLine: true };
  const environment: CatalogActivityEnvironment = {
    window,
    document,
    navigator,
    now: () => now,
  };
  async function advance(milliseconds: number) {
    now += milliseconds;
    await flush();
  }
  return { environment, window, document, navigator, advance };
}
test("watcher performs no initial or periodic check, ignores online events and cleans up", async () => {
  const f = fixture();
  let count = 0;
  const stop = watchCatalogActivity(() => {
    count++;
  }, f.environment);
  assert.equal(count, 0);
  f.document.visibilityState = "hidden";
  await f.advance(15000);
  assert.equal(count, 0);
  f.document.visibilityState = "visible";
  f.navigator.onLine = false;
  await f.advance(15000);
  assert.equal(count, 0);
  f.window.fire("online");
  assert.equal(count, 0);
  f.navigator.onLine = true;
  f.window.fire("online");
  await f.advance(60000);
  assert.equal(count, 0);
  assert.equal(f.window.listeners.has("online"), false);
  f.window.fire("focus");
  assert.equal(count, 1);
  await flush();
  await f.advance(60000);
  assert.equal(count, 1);
  f.window.fire("pageshow");
  assert.equal(count, 2);
  stop();
  stop();
  assert.equal(f.window.count, 0);
  assert.equal(f.document.count, 0);
  f.window.fire("focus");
  await f.advance(30000);
  assert.equal(count, 2);
});
test("focus, pageshow and visible transitions check immediately while a burst starts once", async () => {
  const f = fixture();
  let count = 0;
  const stop = watchCatalogActivity(() => {
    count++;
  }, f.environment);
  f.window.fire("focus");
  f.window.fire("pageshow");
  f.document.fire("visibilitychange");
  f.window.fire("online");
  assert.equal(count, 1);
  await flush();
  await f.advance(999);
  f.window.fire("focus");
  assert.equal(count, 1);
  await f.advance(1);
  f.window.fire("pageshow");
  assert.equal(count, 2);
  await flush();
  f.document.visibilityState = "hidden";
  await f.advance(1000);
  f.document.fire("visibilitychange");
  assert.equal(count, 2);
  f.document.visibilityState = "visible";
  f.document.fire("visibilitychange");
  assert.equal(count, 3);
  stop();
});
test("long async checks never overlap; repeated in-flight activity becomes one pending check", async () => {
  const f = fixture();
  let count = 0,
    active = 0,
    maxActive = 0;
  const finish: (() => void)[] = [];
  const stop = watchCatalogActivity(async () => {
    count++;
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise<void>((resolve) => finish.push(resolve));
    active--;
  }, f.environment);
  f.window.fire("focus");
  assert.equal(count, 1);
  await f.advance(1000);
  f.window.fire("focus");
  f.window.fire("pageshow");
  f.document.fire("visibilitychange");
  await f.advance(20000);
  f.window.fire("online");
  assert.equal(count, 1);
  finish.shift()!();
  await flush();
  assert.equal(count, 2);
  assert.equal(maxActive, 1);
  finish.shift()!();
  await flush();
  assert.equal(count, 2);
  assert.equal(active, 0);
  stop();
});
test("cleanup or becoming hidden drops a pending restart; a failed check can retry on reopening", async () => {
  const f = fixture();
  let count = 0,
    resolve: (() => void) | undefined;
  const stop = watchCatalogActivity(() => {
    count++;
    return new Promise<void>((r) => {
      resolve = r;
    });
  }, f.environment);
  f.window.fire("focus");
  await f.advance(1000);
  f.window.fire("focus");
  stop();
  resolve!();
  await flush();
  assert.equal(count, 1);
  const g = fixture();
  let attempts = 0;
  const stop2 = watchCatalogActivity(() => {
    attempts++;
    throw new Error("offline refresh");
  }, g.environment);
  g.window.fire("focus");
  await flush();
  await g.advance(15000);
  assert.equal(attempts, 1);
  g.window.fire("pageshow");
  assert.equal(attempts, 2);
  stop2();
  const h = fixture();
  let hiddenCount = 0,
    finish: (() => void) | undefined;
  const stop3 = watchCatalogActivity(() => {
    hiddenCount++;
    return new Promise<void>((r) => {
      finish = r;
    });
  }, h.environment);
  h.window.fire("focus");
  await h.advance(1000);
  h.window.fire("pageshow");
  h.document.visibilityState = "hidden";
  finish!();
  await flush();
  assert.equal(hiddenCount, 1);
  stop3();
});
