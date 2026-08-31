/**
 * Generic LRU (Least Recently Used) Cache with TTL support
 * Thiết kế chuẩn O(1) cho Audio Discovery, Stream URLs và UI Components
 */
export interface LRUCacheOptions<V> {
  maxSize: number;
  defaultTtlMs?: number;
  onEvict?: (key: string, value: V) => void;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  approxBytes: number;
}

export class LRUCache<V> {
  private cache = new Map<string, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;
  private readonly onEvict?: (key: string, value: V) => void;

  constructor(options: LRUCacheOptions<V>) {
    this.maxSize = Math.max(1, options.maxSize);
    this.defaultTtlMs = options.defaultTtlMs ?? 15 * 60 * 1000;
    this.onEvict = options.onEvict;
  }

  public get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Kiểm tra hết hạn TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      if (this.onEvict) this.onEvict(key, entry.value);
      return undefined;
    }

    // Refresh vị trí MRU (Most Recently Used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: V, customTtlMs?: number): void {
    const now = Date.now();
    const ttl = customTtlMs ?? this.defaultTtlMs;
    const approxBytes = this.estimateSize(value);

    // Nếu key đã tồn tại, xóa trước để cập nhật vị trí mới nhất
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict phần tử cũ nhất (LRU - First element in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldestEntry = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        if (oldestEntry && this.onEvict) {
          this.onEvict(oldestKey, oldestEntry.value);
        }
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      approxBytes,
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      if (this.onEvict) this.onEvict(key, entry.value);
      return true;
    }
    return false;
  }

  public clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache.entries()) {
        this.onEvict(key, entry.value);
      }
    }
    this.cache.clear();
  }

  public pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        if (this.onEvict) this.onEvict(key, entry.value);
      }
    }
  }

  public get size(): number {
    this.pruneExpired();
    return this.cache.size;
  }

  public getTotalBytes(): number {
    this.pruneExpired();
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.approxBytes;
    }
    return total;
  }

  private estimateSize(obj: unknown): number {
    try {
      const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
      return str ? str.length * 2 : 128; // UTF-16 ~ 2 bytes per char
    } catch {
      return 256;
    }
  }
}

// Singletons dùng chung cho toàn bộ app
export const discoveryRecLRU = new LRUCache<any>({
  maxSize: 30, // Tối đa 30 kết quả truy vấn nghệ sĩ
  defaultTtlMs: 15 * 60 * 1000, // 15 phút
});

export const discoveryStreamLRU = new LRUCache<string>({
  maxSize: 50, // Tối đa 50 URL stream nghe thử
  defaultTtlMs: 20 * 60 * 1000, // 20 phút
});

