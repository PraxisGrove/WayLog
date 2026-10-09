let tripsLocalWriteTail: Promise<void> = Promise.resolve();
let tripSyncMetadataWriteTail: Promise<void> = Promise.resolve();

/**
 * 串行化同一份本地 Trips 集合的读改写事务。
 * AsyncStorage 以整份数组存储 Trips，因此首版使用集合级互斥避免不同入口互相覆盖。
 */
export async function runWithTripsLocalWriteLock<TResult>(
  work: () => Promise<TResult>,
): Promise<TResult> {
  const previous = tripsLocalWriteTail;
  let release: (() => void) | undefined;
  tripsLocalWriteTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await work();
  } finally {
    release?.();
  }
}

/** 串行化完整同步元数据对象的读改写，避免不同 Trip 的 dirty 标记互相覆盖。 */
export async function runWithTripSyncMetadataWriteLock<TResult>(
  work: () => Promise<TResult>,
): Promise<TResult> {
  const previous = tripSyncMetadataWriteTail;
  let release: (() => void) | undefined;
  tripSyncMetadataWriteTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await work();
  } finally {
    release?.();
  }
}
