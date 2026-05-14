// 캐릭터/적 인라인 SVG 실루엣. 원본 추상 디자인.
// 모두 viewBox="0 0 56 56", stroke="currentColor" — CSS color로 톤 조절 가능.

const wrap = (inner, stroke = 'currentColor') => `
  <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"
       width="100%" height="100%" fill="none"
       stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </svg>`;

export const PORTRAITS = {
  // ─── 플레이어 ───
  // 조사관: 후드 두른 사람 실루엣 + 가슴의 눈
  protagonist: wrap(`
    <path d="M28 8 C22 8 18 12 18 18 L18 22 C18 26 22 28 28 28 C34 28 38 26 38 22 L38 18 C38 12 34 8 28 8 Z" fill="rgba(216,169,87,0.12)"/>
    <path d="M14 50 C14 38 20 32 28 32 C36 32 42 38 42 50"/>
    <circle cx="28" cy="40" r="2.5" fill="currentColor"/>
    <path d="M22 18 Q28 14 34 18"/>
    <circle cx="24" cy="20" r="1" fill="currentColor"/>
    <circle cx="32" cy="20" r="1" fill="currentColor"/>
  `, '#f0d9a5'),

  // 서생: 책 + 눈 글리프
  scholar: wrap(`
    <path d="M14 14 L14 42 L28 38 L42 42 L42 14 L28 18 Z" fill="rgba(160,120,224,0.12)"/>
    <path d="M28 18 L28 38"/>
    <circle cx="28" cy="28" r="3" />
    <circle cx="28" cy="28" r="0.8" fill="currentColor"/>
    <path d="M18 22 L22 24 M34 24 L38 22"/>
  `, '#d8c8f0'),

  // 척후: 활/시위 + 후드
  scout: wrap(`
    <path d="M22 8 Q14 10 14 22 L18 24 L20 22 Q20 16 26 14"/>
    <path d="M16 48 C16 38 22 32 28 32 C34 32 40 38 40 48"/>
    <path d="M44 14 Q48 28 44 42"/>
    <path d="M48 28 L20 28"/>
    <circle cx="22" cy="20" r="1" fill="currentColor"/>
  `, '#b0d0a0'),

  // ─── 적 ───
  // 잔재: 부서지는 사람
  husk: wrap(`
    <path d="M28 10 C24 10 22 14 22 18 C22 22 24 24 28 24 C32 24 34 22 34 18 C34 14 32 10 28 10 Z" />
    <path d="M18 50 L24 26 L32 26 L38 50"/>
    <path d="M26 30 L24 36 M30 32 L32 40 M22 42 L20 46"/>
    <circle cx="26" cy="17" r="0.8" fill="currentColor"/>
    <circle cx="30" cy="17" r="0.8" fill="currentColor"/>
  `, '#e0a090'),

  // 광신도: 후드 + 위의 촛불
  cultist: wrap(`
    <path d="M28 4 L28 10" stroke-width="2"/>
    <ellipse cx="28" cy="8" rx="2" ry="3.5" fill="rgba(240,160,60,0.4)"/>
    <path d="M16 50 C16 38 22 32 28 32 C34 32 40 38 40 50"/>
    <path d="M28 18 C20 18 18 22 18 28 C18 32 22 34 28 34 C34 34 38 32 38 28 C38 22 36 18 28 18 Z" fill="rgba(0,0,0,0.4)"/>
    <path d="M22 26 L26 28 L22 30"/>
    <path d="M34 26 L30 28 L34 30"/>
  `, '#f0c860'),

  // 관찰자: 여러 시선
  watcher: wrap(`
    <circle cx="20" cy="22" r="6" fill="rgba(120,180,240,0.12)"/>
    <circle cx="36" cy="20" r="5" fill="rgba(120,180,240,0.12)"/>
    <circle cx="28" cy="36" r="4.5" fill="rgba(120,180,240,0.12)"/>
    <circle cx="14" cy="38" r="3" fill="rgba(120,180,240,0.12)"/>
    <circle cx="42" cy="40" r="3.5" fill="rgba(120,180,240,0.12)"/>
    <circle cx="20" cy="22" r="2" fill="currentColor"/>
    <circle cx="36" cy="20" r="1.6" fill="currentColor"/>
    <circle cx="28" cy="36" r="1.4" fill="currentColor"/>
    <circle cx="14" cy="38" r="1" fill="currentColor"/>
    <circle cx="42" cy="40" r="1.1" fill="currentColor"/>
  `, '#a0c8f0'),

  // 심해의 종: 비늘 무늬 + 지느러미
  thrall: wrap(`
    <path d="M28 10 C22 10 18 14 18 20 C18 24 20 26 24 28 L24 36 L20 50 L36 50 L32 36 L32 28 C36 26 38 24 38 20 C38 14 34 10 28 10 Z" fill="rgba(80,160,200,0.15)"/>
    <path d="M24 18 Q28 16 32 18" />
    <circle cx="24" cy="20" r="0.8" fill="currentColor"/>
    <circle cx="32" cy="20" r="0.8" fill="currentColor"/>
    <path d="M22 32 L18 36 M22 38 L18 42 M34 32 L38 36 M34 38 L38 42"/>
  `, '#80b0d0'),

  // 심연의 자손: 촉수 머리
  spawn: wrap(`
    <ellipse cx="28" cy="22" rx="14" ry="11" fill="rgba(180,80,200,0.18)"/>
    <circle cx="22" cy="21" r="1.5" fill="currentColor"/>
    <circle cx="34" cy="21" r="1.5" fill="currentColor"/>
    <path d="M14 34 Q12 42 16 50"/>
    <path d="M20 34 Q18 46 24 52"/>
    <path d="M28 34 Q28 46 28 52"/>
    <path d="M36 34 Q38 46 32 52"/>
    <path d="M42 34 Q44 42 40 50"/>
  `, '#d090e0'),

  // 슈고스렛: 거품
  shoggothLet: wrap(`
    <circle cx="20" cy="22" r="8" fill="rgba(200,100,220,0.18)"/>
    <circle cx="36" cy="20" r="7" fill="rgba(180,80,200,0.18)"/>
    <circle cx="30" cy="34" r="9" fill="rgba(220,120,240,0.18)"/>
    <circle cx="16" cy="38" r="5" fill="rgba(160,60,180,0.18)"/>
    <circle cx="40" cy="38" r="4" fill="rgba(160,60,180,0.18)"/>
    <circle cx="18" cy="22" r="1.4" fill="currentColor"/>
    <circle cx="38" cy="19" r="1.2" fill="currentColor"/>
    <circle cx="28" cy="34" r="1.6" fill="currentColor"/>
    <circle cx="15" cy="38" r="0.8" fill="currentColor"/>
  `, '#e0a0f0'),

  // ─── 보스 ───
  // 엮는 자: 거미
  bossWeaver: wrap(`
    <ellipse cx="28" cy="28" rx="9" ry="7" fill="rgba(240,80,80,0.18)"/>
    <circle cx="24" cy="26" r="1.6" fill="currentColor"/>
    <circle cx="32" cy="26" r="1.6" fill="currentColor"/>
    <circle cx="28" cy="30" r="1" fill="currentColor"/>
    <path d="M19 22 L8 14 M19 28 L6 26 M19 34 L8 42 M37 22 L48 14 M37 28 L50 26 M37 34 L48 42 M22 21 L18 8 M34 21 L38 8" stroke-width="1.4"/>
  `, '#f08080'),

  // 의식의 집전자: 긴 후드 + 펜타그램
  bossTheRitualist: wrap(`
    <path d="M28 4 L24 18 L8 22 L20 32 L16 50 L28 42 L40 50 L36 32 L48 22 L32 18 Z" fill="rgba(240,80,180,0.10)" stroke-width="1.2"/>
    <path d="M28 14 C22 14 18 18 18 24 L18 32 L22 30 L34 30 L38 32 L38 24 C38 18 34 14 28 14 Z" fill="rgba(0,0,0,0.5)"/>
    <circle cx="24" cy="22" r="1" fill="currentColor"/>
    <circle cx="32" cy="22" r="1" fill="currentColor"/>
    <path d="M22 32 L18 50 M34 32 L38 50"/>
  `, '#f080d0'),

  // 잠든 자: 외눈박이 + 촉수
  bossSleeperOfTheDeep: wrap(`
    <circle cx="28" cy="22" r="14" fill="rgba(140,200,240,0.10)"/>
    <circle cx="28" cy="22" r="6" fill="rgba(0,0,0,0.6)"/>
    <circle cx="28" cy="22" r="3" fill="currentColor"/>
    <circle cx="28" cy="22" r="1" fill="rgba(0,0,0,0.8)"/>
    <path d="M14 36 Q10 44 16 52" stroke-width="1.8"/>
    <path d="M20 38 Q18 48 24 54" stroke-width="1.8"/>
    <path d="M28 38 Q28 48 28 54" stroke-width="1.8"/>
    <path d="M36 38 Q38 48 32 54" stroke-width="1.8"/>
    <path d="M42 36 Q46 44 40 52" stroke-width="1.8"/>
  `, '#80c8f0'),
};

export function getPortraitSVG(actorId) {
  return PORTRAITS[actorId] || null;
}
