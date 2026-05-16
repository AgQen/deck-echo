// 최소 서비스 워커 — PWA 설치 가능 요건만 충족. 캐싱은 하지 않음 (콘텐츠가 자주 바뀜).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* 통과 */ });
