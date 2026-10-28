// Test storage only. Production always uses the Netlify SDK and site credentials.
export class MemoryBlobStore {
  records = new Map();
  writes = 0;
  conflicts = 0;
  rejectWrites = 0;
  unavailable = false;
  async getWithMetadata(key) {
    if (this.unavailable) throw new Error("TestStorageUnavailable");
    const value = this.records.get(key);
    return value
      ? { data: value.bytes.slice(0), etag: value.etag, metadata: {} }
      : null;
  }
  async get(key) {
    return (await this.getWithMetadata(key))?.data ?? null;
  }
  async set(key, data, condition = {}) {
    if (this.unavailable) throw new Error("TestStorageUnavailable");
    const bytes = await data.arrayBuffer();
    const current = this.records.get(key);
    if (
      this.rejectWrites > 0 ||
      (condition.onlyIfNew && current) ||
      (condition.onlyIfMatch && current?.etag !== condition.onlyIfMatch)
    ) {
      if (this.rejectWrites > 0) this.rejectWrites--;
      this.conflicts++;
      return { modified: false };
    }
    const etag = `"test-revision-${++this.writes}"`;
    this.records.set(key, { bytes, etag });
    return { modified: true, etag };
  }
  async delete(key) {
    this.records.delete(key);
  }
}

export function memoryStores() {
  return { state: new MemoryBlobStore(), files: new MemoryBlobStore() };
}
