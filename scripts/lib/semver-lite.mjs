export function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function latestPerMajor(versions) {
  const byMajor = new Map();
  for (const version of versions) {
    const major = version.split('.')[0];
    const current = byMajor.get(major);
    if (current === undefined || compareVersions(version, current) > 0) {
      byMajor.set(major, version);
    }
  }
  return byMajor;
}
