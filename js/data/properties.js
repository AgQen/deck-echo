// 데미지 속성과 내성 단계 정의.
// 추후 속성/내성 조합을 늘리려면 이 파일만 수정.

export const PROPERTIES = {
  참격: { label: '참격', kind: 'physical', target: 'hp', color: '#e06060' },
  관통: { label: '관통', kind: 'physical', target: 'hp', color: '#e0a060' },
  타격: { label: '타격', kind: 'physical', target: 'hp', color: '#c0a060' },
  정신: { label: '정신', kind: 'mental',   target: 'sp', color: '#80a0e0' },
  공포: { label: '공포', kind: 'mental',   target: 'sp', color: '#b080e0' },
};

// 내성 레벨 → 데미지 배율.
// 흐트러짐 상태에서는 모든 항목이 '취약'으로 강제됨 (battle/clash 측에서 처리).
export const RESIST_LEVEL = {
  면역: 0.0,
  저항: 0.5,
  일반: 1.0,
  취약: 2.0,
  치명: 3.0,
};

// 캐릭터/적의 기본 내성 템플릿 (없으면 일반)
export const DEFAULT_RESIST = {
  참격: '일반', 관통: '일반', 타격: '일반',
  정신: '일반', 공포: '일반',
};

export function effectiveResist(actor, prop) {
  if (actor.disordered) return RESIST_LEVEL.취약;
  const lvl = (actor.resist && actor.resist[prop]) || DEFAULT_RESIST[prop] || '일반';
  return RESIST_LEVEL[lvl] ?? 1.0;
}
