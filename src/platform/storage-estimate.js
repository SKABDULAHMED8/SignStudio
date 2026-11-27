export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return { usage: null, quota: null, percent: null };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, percent: quota ? Math.round(usage / quota * 100) : null };
}
