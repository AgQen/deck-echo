// 시드 가능한 RNG (Mulberry32). 저장/이어하기에서 일관성 위해.
export function makeRng(seed = Date.now() >>> 0) {
  let s = seed >>> 0;
  const fn = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.int = (lo, hi) => Math.floor(fn() * (hi - lo + 1)) + lo;
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length)];
  fn.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(fn() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  fn.seed = () => s;
  return fn;
}
