/**
 * BoundedExpiringSet - Cấu trúc dữ liệu Set có giới hạn dung lượng tối đa và TTL tự hủy
 * Đảm bảo React State không bao giờ tích tụ chuỗi ID vô hạn trong bộ nhớ.
 */
export interface BoundedSetOptions {
  maxSize?: number;
  ttlMs?: number; // Thời gian sống tính bằng mili-giây (mặc định 5 phút)
}

export class BoundedExpiringSet {
  private items = new Map<string, number>(); // key -> timestamp expiresAt
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(options: BoundedSetOptions = {}) {
    this.maxSize = options.maxSize ?? 64;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 phút
  }

  public add(key: string): this {
    if (!key) return this;
    const now = Date.now();
    this.prune(now);

    // Nếu vượt quá maxSize, xóa phần tử cũ nhất (FIFO/LRU)
    if (this.items.size >= this.maxSize && !this.items.has(key)) {
      const oldestKey = this.items.keys().next().value;
      if (oldestKey !== undefined) {
        this.items.delete(oldestKey);
      }
    }

    this.items.set(key, now + this.ttlMs);
    return this;
  }

  public addMany(keys: Iterable<string>): this {
    for (const key of keys) {
      this.add(key);
    }
    return this;
  }

  public has(key: string): boolean {
    const expiresAt = this.items.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.items.delete(key);
      return false;
    }
    return true;
  }

  public delete(key: string): boolean {
    return this.items.delete(key);
  }

  public clear(): void {
    this.items.clear();
  }

  public prune(now = Date.now()): void {
    for (const [key, expiresAt] of this.items.entries()) {
      if (now > expiresAt) {
        this.items.delete(key);
      }
    }
  }

  public toSet(): Set<string> {
    this.prune();
    return new Set(this.items.keys());
  }

  public get size(): number {
    this.prune();
    return this.items.size;
  }
}
