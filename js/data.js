"use strict";

/** 강호혈풍록 웹 — 프롤로그, 성수비경, 자미원, 세외, 산해경 */

const GANGHO = {
  gradeName: { 1: "입문", 2: "제식", 3: "기철", 4: "전승", 5: "신화" },
  gradeColor: { 1: "#a39886", 2: "#e4e4e4", 3: "#79a7ff", 4: "#e0b0ff", 5: "#e6c56a" },

  nodes: [
    { id: "gihae", name: "기해혈", desc: "최대 내공 +24", cost: 1, fx: { qi: 24 } },
    { id: "danjeon", name: "단전", desc: "내공 회복 +4", cost: 1, fx: { qiRegen: 4 } },
    { id: "myeongmun", name: "명문혈", desc: "최대 생명 +28", cost: 1, fx: { hp: 28 } },
    { id: "gimun", name: "기문혈", desc: "호신강기 +24", cost: 1, fx: { shield: 24 } },
    { id: "baekhoe", name: "백회혈", desc: "치명타 확률 +8%", cost: 1, fx: { crit: 0.08 } },
    { id: "joksam", name: "족삼리", desc: "이동 속도 +8%", cost: 1, fx: { move: 0.08 } },
    { id: "yongcheon", name: "용천혈", desc: "경공 재사용 −20%", cost: 1, fx: { dashCd: -0.2 } },
    { id: "gwaneon", name: "관원혈", desc: "모든 무공 위력 +12%", cost: 1, fx: { dmg: 0.12 } },
    {
      id: "juhwa",
      name: "주화입마",
      desc: "받는 피해 +30%, 모든 무공 위력 +50%. 작은 혈자리 2개를 연 뒤 찍을 수 있다.",
      cost: 2,
      need: 2,
      keystone: true,
      fx: {},
    },
  ],

  enemies: {
    grunt: {
      name: "살수", r: 16, hp: 108, dmg: 8, speed: 108, range: 48, cd: 1.2,
      windup: 0.46, armor: 0, xp: 7, color: "#7a3038",
    },
    thrower: {
      name: "암기수", r: 15, hp: 84, dmg: 10, speed: 86, range: 340, prefer: 250,
      cd: 1.65, windup: 0.36, armor: 0, xp: 9, color: "#3d4d68", ranged: true,
    },
    elite: {
      name: "강기 호위", r: 22, hp: 420, shield: 170, dmg: 16, speed: 76, range: 64,
      cd: 1.4, windup: 0.52, armor: 18, xp: 24, color: "#8d6a34",
    },
    boss: {
      name: "야율한", title: "혈사단주", r: 34, hp: 2600, shield: 460, dmg: 22,
      speed: 92, range: 86, cd: 1.28, windup: 0.48, armor: 26, xp: 90,
      color: "#4c141c", boss: true,
    },
    dummy: {
      name: "수련 허수아비", r: 28, hp: 1, dmg: 0, speed: 0, range: 0, cd: 99,
      windup: 0, armor: 12, xp: 0, color: "#c2a15a", dummy: true,
    },
    pillar: {
      name: "뇌전 기둥", r: 26, hp: 240, dmg: 0, speed: 0, range: 0, cd: 99,
      windup: 0, armor: 6, xp: 8, color: "#7ec8c3", pillar: true,
    },
  },

  waves: [
    {
      title: "제1파 · 담을 넘는 살수",
      hint: "좌클릭 평타, Space 경공. 무리를 한 번에 베어라.",
      groups: [{ type: "grunt", n: 7 }],
    },
    {
      title: "제2파 · 암기와 검흔",
      hint: "검흔이 남은 적에게 타격을 겹치면 내상이 난다.",
      groups: [{ type: "grunt", n: 5 }, { type: "thrower", n: 3 }],
    },
    {
      title: "제3파 · 호신강기",
      hint: "정예의 강기를 깨면 잠시 빈틈이 열린다.",
      groups: [{ type: "grunt", n: 4 }, { type: "elite", n: 2 }, { type: "thrower", n: 2 }],
    },
    {
      title: "혈사단주 야율한",
      hint: "살수단의 우두머리. 호신강기가 깨진 뒤에만 깊게 베인다.",
      boss: true,
    },
  ],

  items: {
    mokgeom: { name: "목검", slot: "weapon", grade: 1, desc: "수련용 목검. 날 대신 무게만 있다.", dmg: 0 },
    iron: { name: "수련용 철검", slot: "weapon", grade: 2, desc: "제식 철검. 위력이 오른다.", dmg: 0.12 },
    baek: { name: "백철도", slot: "weapon", grade: 2, desc: "가벼운 도. 평타가 조금 빨라진다.", dmg: 0.08, aspd: 0.1 },
    hwando: { name: "환두대도", slot: "weapon", grade: 2, desc: "고리 자루의 큰 칼. 베는 힘이 세다.", dmg: 0.16 },
    muk: { name: "묵철도", slot: "weapon", grade: 3, desc: "묵철. 호신강기를 크게 파쇄한다.", dmg: 0.1, shieldMul: 0.5 },
    cloth: { name: "마포 도복", slot: "armor", grade: 1, desc: "거친 삼베. 숨통이 조금 길어진다.", hp: 22 },
    silk: { name: "항주 비단 직철", slot: "armor", grade: 2, desc: "항주 비단을 겹친 옷. 살이 두텁다.", hp: 16, armor: 8 },
    mongol: { name: "몽골 비단 갑옷", slot: "armor", grade: 3, desc: "기동을 유지한 채 암기를 흘린다.", armor: 6, projResist: 0.28 },
    snow: { name: "설표 가죽", slot: "armor", grade: 2, desc: "가벼운 모피. 발이 빨라진다.", hp: 12, move: 0.07 },
    charm: { name: "영수 호신부", slot: "charm", grade: 3, desc: "위험할 때 스스로 강기를 한 겹 두른다.", guardProc: 0.12, guardShield: 28 },
    jade: { name: "문파 옥패", slot: "charm", grade: 2, desc: "단전의 회전이 고와진다.", qiRegen: 3.5, qi: 10 },
    bottle: { name: "영약 호리병", slot: "charm", grade: 3, desc: "호리병에 남은 영약. 회복이 진하고 한 모금이 더 있다.", potion: 0.14, potionsBonus: 1 },
    songmun: { name: "송문고검", slot: "weapon", grade: 4, desc: "무당 전승 신병. 검기가 가볍다.", dmg: 0.26, qiCost: -0.12 },
    dalma: { name: "달마금강선장", slot: "weapon", grade: 4, desc: "소림 전승. 호신강기를 부수는 지팡이.", dmg: 0.18, shieldMul: 0.4 },
    gwon: { name: "음양태극권갑", slot: "weapon", grade: 4, desc: "태극의 권갑. 몸이 단단해진다.", dmg: 0.14, hp: 36, shield: 16 },
    hyeolma: { name: "혈마도", slot: "weapon", grade: 4, desc: "혈마가의 도. 벤 상처를 자신의 피로 되돌린다.", dmg: 0.22, lifesteal: 0.07 },
    cheongryong: { name: "청룡언월도", slot: "weapon", grade: 4, desc: "뇌전을 머금은 언월도.", dmg: 0.2, crit: 0.06 },
    docheol: { name: "도철아귀갑", slot: "weapon", grade: 4, desc: "집어삼키는 권갑. 타격할 때마다 강기가 붙는다.", dmg: 0.12, shieldOnHit: 7 },
    dokgo: { name: "독고단검", slot: "weapon", grade: 4, desc: "방어의 틈을 찾는 독고의 검.", dmg: 0.24, crit: 0.08 },
    nokrim: { name: "녹림대도", slot: "weapon", grade: 4, desc: "산채의 큰 칼. 무리를 베기 좋다.", dmg: 0.2, hp: 20 },
    baekpa: { name: "백가강시패", slot: "weapon", grade: 4, desc: "백가의 패. 생명과 독을 함께 끌어온다.", dmg: 0.12, hp: 40, potion: 0.08 },
    ryongap: { name: "교룡 비늘갑", slot: "armor", grade: 5, desc: "창해뇌신의 비늘. 암기와 벼락을 함께 흘린다.", hp: 32, projResist: 0.22, crit: 0.04 },
    hancheol: { name: "만년한철갑", slot: "armor", grade: 5, desc: "극한심연에서 건진 한철. 살이 매우 두텁다.", hp: 26, armor: 16 },
    mukcham: { name: "묵철참도", slot: "weapon", grade: 5, desc: "살성패왕의 참격이 남은 도.", dmg: 0.28, crit: 0.05 },
    bongui: { name: "봉황깃 직철", slot: "armor", grade: 5, desc: "열반화조의 깃. 불길 속에서도 숨이 붙는다.", hp: 36, potion: 0.1 },
    heonwon: { name: "헌원검", slot: "weapon", grade: 5, desc: "황룡이 내려 준 검. 오행이 한 자루에 모인다.", dmg: 0.34, crit: 0.06, qiCost: -0.1 },
    bango: { name: "반고부", slot: "charm", grade: 5, desc: "하늘을 가른 도끼의 조각. 위력과 내공이 함께 오른다.", dmg: 0.12, qi: 24 },
    gonryun: { name: "곤륜지갑", slot: "armor", grade: 5, desc: "곤륜의 흙으로 빚은 갑옷.", armor: 18, shield: 30, hp: 24 },
  },

  characters: [
    {
      id: "murim",
      name: "무림맹 무사",
      faction: "정파",
      factionId: "orthodox",
      role: "만능 시너지형",
      title: "만류귀종",
      power: 0.85,
      mechanic: "manryu",
      summary: "구파일방과 오대세가의 일반 무공을 모두 쓰되 최종 절기는 없다. 위력은 85%. 문파를 바꿔 칠 때마다 만류귀종이 쌓이고, 다섯 겹에서 터진다.",
      color: "#b7d4de",
      rewards: ["songmun", "dalma", "gwon"],
      basic: {
        name: "맹검 삼식",
        school: "무림맹",
        tag: "검흔",
        steps: [
          { dmg: 26, range: 78, arc: 1.05, dur: 0.16, knock: 70 },
          { dmg: 32, range: 84, arc: 1.15, dur: 0.16, knock: 90 },
          { dmg: 48, range: 98, arc: 1.5, dur: 0.24, knock: 140, hitstop: 0.05 },
        ],
      },
      skills: [
        { key: "Q", name: "금강권", desc: "소림의 권각. 검흔 위에 겹치면 내상이 된다.", school: "소림", tag: "타격", cd: 4.2, qi: 16, kind: "arc", dmg: 72, range: 100, arc: 1.2, knock: 160 },
        { key: "W", name: "매화삼연", desc: "화산의 검. 맞은 적에게 출혈이 번진다.", school: "화산", tag: "검흔", cd: 5, qi: 20, kind: "arc", dmg: 58, range: 108, arc: 1.35, knock: 40, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
        { key: "E", name: "당가독침", desc: "사천당가의 독침. 출혈과 겹치면 혈독이 된다.", school: "당가", tag: "중독", cd: 5.2, qi: 18, kind: "proj", dmg: 36, count: 1, speed: 680, pierce: 3, spread: 0, statuses: [{ id: "중독", t: 5, stacks: 2 }] },
        { key: "R", name: "항룡장", desc: "개방의 장풍. 주변의 적을 밀어낸다.", school: "개방", tag: "타격", cd: 9, qi: 34, kind: "nova", dmg: 120, radius: 118, knock: 220 },
      ],
    },
    {
      id: "gupil",
      name: "구파일방 전인",
      faction: "정파",
      factionId: "orthodox",
      role: "연합 공동전인형",
      title: "화산 · 이십사수 매화검법",
      power: 1,
      mechanic: "ultimate",
      summary: "구파일방의 몸놀림으로 자리를 잡고, 최종 절기는 화산의 이십사수 매화검법 하나만 골랐다.",
      color: "#f0d0d4",
      rewards: ["songmun", "dalma", "gwon"],
      basic: {
        name: "매화검",
        school: "화산",
        tag: "검흔",
        steps: [
          { dmg: 28, range: 82, arc: 1.0, dur: 0.15, knock: 40 },
          { dmg: 34, range: 86, arc: 1.1, dur: 0.15, knock: 50 },
          { dmg: 52, range: 102, arc: 1.55, dur: 0.22, knock: 80, hitstop: 0.05, statuses: [{ id: "출혈", t: 3.5, stacks: 1 }] },
        ],
      },
      skills: [
        { key: "Q", name: "이형환위", desc: "비스듬히 파고들며 베는 보법.", school: "화산", tag: "검흔", cd: 4.5, qi: 14, kind: "dash", dmg: 64, dist: 168 },
        { key: "W", name: "호신결", desc: "잠시 피해를 흘리고 호신강기를 두른다.", school: "무당", tag: "방어", cd: 7.5, qi: 16, kind: "guard", shield: 55, dr: 0.4, duration: 2.2 },
        { key: "E", name: "유성검기", desc: "일직선으로 관통하는 검기.", school: "화산", tag: "검흔", cd: 5, qi: 18, kind: "proj", dmg: 70, count: 1, speed: 720, pierce: 4, spread: 0 },
        { key: "R", name: "이십사수 매화", desc: "최종 절기. 매화 스물네 수가 발 아래에 핀다.", school: "화산", tag: "검흔", cd: 11, qi: 40, kind: "nova", dmg: 168, radius: 132, knock: 80, statuses: [{ id: "출혈", t: 5, stacks: 3 }] },
      ],
    },
    {
      id: "hwangbo",
      name: "오대세가 전인",
      faction: "정파",
      factionId: "orthodox",
      role: "5대 명문 혈맥형",
      title: "황보세가 · 호신강기",
      power: 1,
      mechanic: "shred",
      summary: "황보세가의 권각. 호신강기를 부수고, 모아 둔 강기를 한 번에 터뜨린다.",
      color: "#f0d7a8",
      rewards: ["songmun", "dalma", "gwon"],
      basic: {
        name: "황보권",
        school: "황보",
        tag: "타격",
        steps: [
          { dmg: 24, range: 72, arc: 1.0, dur: 0.15, knock: 90 },
          { dmg: 30, range: 76, arc: 1.15, dur: 0.15, knock: 110 },
          { dmg: 46, range: 92, arc: 1.4, dur: 0.22, knock: 170, hitstop: 0.05 },
        ],
      },
      skills: [
        { key: "Q", name: "벽력장", desc: "강기를 실어 보호막을 으깬다.", school: "황보", tag: "타격", cd: 4.2, qi: 16, kind: "arc", dmg: 68, range: 96, arc: 1.25, knock: 150 },
        { key: "W", name: "강기전개", desc: "호신강기를 크게 끌어올린다.", school: "황보", tag: "방어", cd: 7, qi: 18, kind: "guard", shield: 90, dr: 0.15, duration: 1.2 },
        { key: "E", name: "지진각", desc: "발을 구르면 주변이 느려진다.", school: "황보", tag: "타격", cd: 6, qi: 20, kind: "zone", dmg: 22, radius: 110, duration: 2.4, every: 0.45, statuses: [{ id: "둔화", t: 1.3 }] },
        { key: "R", name: "강기폭발", desc: "두르고 있던 호신강기를 전부 터뜨린다.", school: "황보", tag: "타격", cd: 10, qi: 28, kind: "burst", base: 48, ratio: 2.15, radius: 130 },
      ],
    },
    {
      id: "socheon",
      name: "예비 소천마",
      faction: "마교",
      factionId: "demonic",
      role: "만능 시너지형",
      title: "마기 공명",
      power: 0.85,
      mechanic: "magi",
      summary: "사대마궁과 호법원의 기본 마공을 교차한다. 최종 절기는 없고 위력은 85%. 다른 마공을 이으면 마기가 한 번 더 친다.",
      color: "#e7a097",
      rewards: ["hyeolma", "cheongryong", "docheol"],
      basic: {
        name: "마검",
        school: "천마",
        tag: "검흔",
        steps: [
          { dmg: 26, range: 78, arc: 1.1, dur: 0.15, knock: 50 },
          { dmg: 30, range: 84, arc: 1.2, dur: 0.15, knock: 60 },
          { dmg: 46, range: 100, arc: 1.5, dur: 0.22, knock: 100, hitstop: 0.045 },
        ],
      },
      skills: [
        { key: "Q", name: "혼돈화", desc: "혼돈마궁의 불길. 발 아래에 피어오른다.", school: "혼돈", tag: "화상", cd: 4.4, qi: 16, kind: "nova", dmg: 64, radius: 104, knock: 40 },
        { key: "W", name: "궁기암습", desc: "가장 가까운 적의 뒤로 파고든다.", school: "궁기", tag: "암살", cd: 5.5, qi: 18, kind: "blink", dmg: 78, reach: 360 },
        { key: "E", name: "도철흡", desc: "도철의 이. 입힌 피해만큼 피를 되돌린다.", school: "도철", tag: "흡수", cd: 5, qi: 18, kind: "arc", dmg: 52, range: 96, arc: 1.3, lifesteal: 0.35 },
        { key: "R", name: "마기폭류", desc: "교차된 마기를 한 번에 쏟는다.", school: "천마", tag: "마기", cd: 10, qi: 36, kind: "nova", dmg: 132, radius: 128, knock: 120 },
      ],
    },
    {
      id: "hobub",
      name: "호법원 전인",
      faction: "마교",
      factionId: "demonic",
      role: "특수 기믹 · 사신수",
      title: "청룡 · 창해뇌신",
      power: 1,
      mechanic: "storm",
      summary: "청룡의 뇌전과 서늘한 바람. 적을 얼어붙게 한 뒤 낙뢰를 내리면 초전도가 주변으로 튄다.",
      color: "#9fd0c8",
      rewards: ["hyeolma", "cheongryong", "docheol"],
      basic: {
        name: "뇌창",
        school: "청룡",
        tag: "뇌전",
        steps: [
          { dmg: 24, range: 88, arc: 0.85, dur: 0.15, knock: 40 },
          { dmg: 30, range: 92, arc: 0.95, dur: 0.15, knock: 50 },
          { dmg: 44, range: 110, arc: 1.25, dur: 0.22, knock: 70, hitstop: 0.04 },
        ],
      },
      skills: [
        { key: "Q", name: "낙뢰", desc: "조준한 적에게 뇌전을 꽂는다. 빙결된 적이면 연쇄한다.", school: "청룡", tag: "뇌전", cd: 4.2, qi: 18, kind: "bolt", dmg: 74, reach: 380 },
        { key: "W", name: "질풍", desc: "멀리 질러가며 베는 경공.", school: "청룡", tag: "풍", cd: 4.8, qi: 14, kind: "dash", dmg: 58, dist: 210 },
        { key: "E", name: "동정풍", desc: "차가운 바람. 적을 빙결시킨다.", school: "현무", tag: "빙결", cd: 6.2, qi: 20, kind: "zone", dmg: 14, radius: 118, duration: 2.6, every: 0.4, statuses: [{ id: "빙결", t: 2.2 }] },
        { key: "R", name: "창해뇌신", desc: "최종 절기. 조준한 자리에 벼락이 연달아 떨어진다.", school: "청룡", tag: "뇌전", cd: 12, qi: 42, kind: "storm", dmg: 42, strikes: 7, radius: 150 },
      ],
    },
    {
      id: "sapa",
      name: "사파맹 투사",
      faction: "사파",
      factionId: "unorthodox",
      role: "만능 시너지형",
      title: "만악귀종",
      power: 0.85,
      mechanic: "manak",
      summary: "오대악가와 녹수맹의 기본 무공. 최종 절기는 없고 위력은 85%. 출혈과 중독이 함께 붙은 적에게 만악귀종이 터지며 피를 빨아들인다.",
      color: "#cbb6ea",
      rewards: ["dokgo", "nokrim", "baekpa"],
      basic: {
        name: "비수",
        school: "낭인",
        tag: "출혈",
        steps: [
          { dmg: 22, range: 70, arc: 1.05, dur: 0.13, knock: 20, statuses: [{ id: "출혈", t: 3.5, stacks: 1 }] },
          { dmg: 26, range: 74, arc: 1.15, dur: 0.13, knock: 24, statuses: [{ id: "출혈", t: 3.5, stacks: 1 }] },
          { dmg: 40, range: 88, arc: 1.45, dur: 0.2, knock: 40, hitstop: 0.04, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
        ],
      },
      skills: [
        { key: "Q", name: "녹림함정", desc: "발밑의 함정. 선 자리에서 피가 샌다.", school: "녹림", tag: "출혈", cd: 5, qi: 16, kind: "zone", dmg: 16, radius: 100, duration: 3, every: 0.45, statuses: [{ id: "출혈", t: 3.5, stacks: 1 }] },
        { key: "W", name: "독무", desc: "자욱한 독. 중독이 겹겹이 쌓인다.", school: "당문", tag: "중독", cd: 5.4, qi: 18, kind: "zone", dmg: 12, radius: 108, duration: 3, every: 0.45, statuses: [{ id: "중독", t: 4, stacks: 1 }] },
        { key: "E", name: "수로참", desc: "장강의 물결처럼 직선으로 베는 참격.", school: "수로", tag: "참격", cd: 4.6, qi: 16, kind: "proj", dmg: 48, count: 1, speed: 640, pierce: 6, spread: 0 },
        { key: "R", name: "혈독인", desc: "출혈과 중독을 한꺼번에 새기고 깊이 벤다.", school: "사파맹", tag: "혈독", cd: 10, qi: 34, kind: "arc", dmg: 96, range: 112, arc: 1.6, knock: 60, statuses: [{ id: "출혈", t: 5, stacks: 3 }, { id: "중독", t: 5, stacks: 3 }] },
      ],
    },
    {
      id: "sinbi",
      name: "신비 세력",
      faction: "정파",
      factionId: "orthodox",
      role: "특수 기믹 · 전환형",
      title: "환골탈태",
      power: 1,
      mechanic: "hwan",
      summary: "보타문, 천봉궁, 은자림 가운데 하나를 쓴다. 객잔의 환골탈태는 혈점을 모두 돌려주고 다른 세력의 나무로 갈아타게 한다.",
      color: "#d9c7a2",
      rewards: ["songmun", "dalma", "gwon"],
      forms: [
        {
          id: "bota",
          name: "보타문",
          title: "보타문 · 자비",
          summary: "자비의 염주. 베는 손길이 곧 숨이 된다.",
          color: "#f0e2b0",
          basic: {
            name: "염주", school: "보타", tag: "타격",
            steps: [
              { dmg: 22, range: 74, arc: 1.05, dur: 0.16, knock: 40 },
              { dmg: 28, range: 78, arc: 1.15, dur: 0.16, knock: 50 },
              { dmg: 40, range: 92, arc: 1.4, dur: 0.22, knock: 70, hitstop: 0.04 },
            ],
          },
          skills: [
            { key: "Q", name: "자비장", desc: "부드러운 장. 맞은 적의 숨결을 나누어 받는다.", school: "보타", tag: "타격", cd: 4.2, qi: 14, kind: "arc", dmg: 48, range: 96, arc: 1.3, lifesteal: 0.4 },
            { key: "W", name: "금강호", desc: "염주가 호신강기가 된다.", school: "보타", tag: "방어", cd: 7.2, qi: 16, kind: "guard", shield: 70, dr: 0.35, duration: 2 },
            { key: "E", name: "정념", desc: "흔들리는 마음을 붙들어 발을 늦춘다.", school: "보타", tag: "둔화", cd: 5.4, qi: 16, kind: "zone", dmg: 12, radius: 110, duration: 2.4, every: 0.45, statuses: [{ id: "둔화", t: 1.4 }] },
            { key: "R", name: "성불", desc: "최종 절기. 자비가 퍼지며 끊긴 숨을 되돌린다.", school: "보타", tag: "치유", cd: 12, qi: 36, kind: "grace", dmg: 70, radius: 120, heal: 0.22 },
          ],
        },
        {
          id: "cheonbong",
          name: "천봉궁",
          title: "천봉궁 · 비검",
          summary: "선도의 비검. 검기가 몸을 떠나 무리를 가른다.",
          color: "#c9d7ee",
          basic: {
            name: "비검", school: "천봉", tag: "검흔",
            steps: [
              { dmg: 24, range: 86, arc: 0.9, dur: 0.14, knock: 30 },
              { dmg: 30, range: 92, arc: 1.0, dur: 0.14, knock: 36 },
              { dmg: 46, range: 108, arc: 1.3, dur: 0.2, knock: 50, hitstop: 0.04 },
            ],
          },
          skills: [
            { key: "Q", name: "어검술", desc: "검을 밟고 비스듬히 빠져나간다.", school: "천봉", tag: "검흔", cd: 4.4, qi: 14, kind: "dash", dmg: 54, dist: 190 },
            { key: "W", name: "삼비검", desc: "비검 세 자루가 일직선으로 나간다.", school: "천봉", tag: "검흔", cd: 5, qi: 18, kind: "proj", dmg: 36, count: 3, speed: 700, pierce: 2, spread: 0.18 },
            { key: "E", name: "낙검", desc: "조준한 적 머리 위로 검이 떨어진다.", school: "천봉", tag: "검흔", cd: 4.6, qi: 16, kind: "bolt", dmg: 72, reach: 400 },
            { key: "R", name: "만검귀종", desc: "최종 절기. 허공의 검이 조준한 자리에 쏟아진다.", school: "천봉", tag: "검흔", cd: 12, qi: 40, kind: "storm", dmg: 38, strikes: 8, radius: 150 },
          ],
        },
        {
          id: "eunja",
          name: "은자림",
          title: "은자림 · 독초",
          summary: "숲의 독초와 영수. 중독이 겹치면 자리가 곧 함정이 된다.",
          color: "#b7d7b0",
          basic: {
            name: "독초", school: "은자", tag: "중독",
            steps: [
              { dmg: 20, range: 76, arc: 1.05, dur: 0.15, knock: 20, statuses: [{ id: "중독", t: 3, stacks: 1 }] },
              { dmg: 26, range: 80, arc: 1.15, dur: 0.15, knock: 24, statuses: [{ id: "중독", t: 3, stacks: 1 }] },
              { dmg: 38, range: 94, arc: 1.4, dur: 0.2, knock: 36, hitstop: 0.04, statuses: [{ id: "중독", t: 4, stacks: 2 }] },
            ],
          },
          skills: [
            { key: "Q", name: "독무", desc: "발밑에 독초가 피어 중독이 쌓인다.", school: "은자", tag: "중독", cd: 5, qi: 16, kind: "zone", dmg: 14, radius: 108, duration: 3, every: 0.45, statuses: [{ id: "중독", t: 4, stacks: 1 }] },
            { key: "W", name: "영수침", desc: "영수의 침. 독이 일직선으로 박힌다.", school: "은자", tag: "중독", cd: 4.6, qi: 16, kind: "proj", dmg: 46, count: 1, speed: 660, pierce: 4, spread: 0, statuses: [{ id: "중독", t: 5, stacks: 2 }] },
            { key: "E", name: "은신", desc: "숲의 그늘로 한 걸음 사라진다.", school: "은자", tag: "보법", cd: 5, qi: 14, kind: "dash", dmg: 36, dist: 170 },
            { key: "R", name: "만독귀종", desc: "최종 절기. 모아 둔 독이 한 번에 터진다.", school: "은자", tag: "중독", cd: 11, qi: 36, kind: "nova", dmg: 128, radius: 128, knock: 40, statuses: [{ id: "중독", t: 6, stacks: 3 }] },
          ],
        },
      ],
    },
    {
      id: "magung",
      name: "사대 마궁 전인",
      faction: "마교",
      factionId: "demonic",
      role: "연합 공동전인형",
      title: "도철포식",
      power: 1,
      mechanic: "devour",
      summary: "혼돈, 궁기, 도올을 두루 쓰되 최종 절기는 도철의 포식 하나다. 도올은 제 피를 깎아 더 세게 친다.",
      color: "#e07a62",
      rewards: ["hyeolma", "cheongryong", "docheol"],
      basic: {
        name: "마궁장", school: "마궁", tag: "타격",
        steps: [
          { dmg: 26, range: 78, arc: 1.1, dur: 0.15, knock: 60 },
          { dmg: 32, range: 84, arc: 1.2, dur: 0.15, knock: 70 },
          { dmg: 48, range: 100, arc: 1.5, dur: 0.22, knock: 110, hitstop: 0.045 },
        ],
      },
      skills: [
        { key: "Q", name: "혼돈진", desc: "혼돈의 안개. 선 자리의 발이 느려진다.", school: "혼돈", tag: "둔화", cd: 5, qi: 16, kind: "zone", dmg: 16, radius: 112, duration: 2.6, every: 0.45, statuses: [{ id: "둔화", t: 1.5 }] },
        { key: "W", name: "궁기암습", desc: "가장 가까운 적의 뒤로 파고든다.", school: "궁기", tag: "암살", cd: 5.2, qi: 18, kind: "blink", dmg: 86, reach: 380 },
        { key: "E", name: "도올광", desc: "제 피를 깎아 주변을 광기로 휩쓴다.", school: "도올", tag: "광폭", cd: 6, qi: 16, kind: "nova", dmg: 96, radius: 112, knock: 80, selfHp: 0.07 },
        { key: "R", name: "도철포식", desc: "최종 절기. 도철이 베인 피를 모두 삼킨다.", school: "도철", tag: "흡수", cd: 11, qi: 38, kind: "arc", dmg: 110, range: 118, arc: 1.7, lifesteal: 0.7, knock: 40 },
      ],
    },
    {
      id: "maga",
      name: "오대 마가 전인",
      faction: "마교",
      factionId: "demonic",
      role: "5대 명문 혈맥형",
      title: "혈마가 · 혈해",
      power: 1,
      mechanic: "blood",
      lifestealBonus: 0.06,
      summary: "검마의 검기, 독마의 독, 진마의 대지를 보조로 쓰고, 최종 절기는 혈마의 혈해다. 벤 상처가 늘 피로 돌아온다.",
      color: "#c45a6a",
      rewards: ["hyeolma", "cheongryong", "docheol"],
      basic: {
        name: "혈도", school: "혈마", tag: "출혈",
        steps: [
          { dmg: 24, range: 80, arc: 1.05, dur: 0.15, knock: 30, statuses: [{ id: "출혈", t: 3, stacks: 1 }] },
          { dmg: 30, range: 86, arc: 1.15, dur: 0.15, knock: 36, statuses: [{ id: "출혈", t: 3, stacks: 1 }] },
          { dmg: 46, range: 102, arc: 1.5, dur: 0.22, knock: 60, hitstop: 0.045, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
        ],
      },
      skills: [
        { key: "Q", name: "검마기", desc: "검마가의 투명한 검기. 일직선을 가른다.", school: "검마", tag: "검흔", cd: 4.4, qi: 16, kind: "proj", dmg: 62, count: 1, speed: 740, pierce: 5, spread: 0 },
        { key: "W", name: "시체독", desc: "독마가의 독이 발밑에서 퍼진다.", school: "독마", tag: "중독", cd: 5.2, qi: 18, kind: "zone", dmg: 14, radius: 108, duration: 2.8, every: 0.45, statuses: [{ id: "중독", t: 4, stacks: 1 }] },
        { key: "E", name: "대지파", desc: "진마가의 발구르기. 주변을 느릿하게 만든다.", school: "진마", tag: "타격", cd: 5.6, qi: 18, kind: "zone", dmg: 20, radius: 116, duration: 2.2, every: 0.4, statuses: [{ id: "둔화", t: 1.3 }] },
        { key: "R", name: "혈해", desc: "최종 절기. 혈마의 바다가 주변의 피를 끌어온다.", school: "혈마", tag: "출혈", cd: 11, qi: 38, kind: "nova", dmg: 140, radius: 130, knock: 50, lifesteal: 0.45, statuses: [{ id: "출혈", t: 5, stacks: 2 }] },
      ],
    },
    {
      id: "noksu",
      name: "녹수맹 전인",
      faction: "사파",
      factionId: "unorthodox",
      role: "연합 공동전인형",
      title: "장강대해소",
      power: 1,
      mechanic: "hunt",
      summary: "녹림의 함정과 낙석으로 무리를 가두고, 최종 절기는 장강수로의 대해소 하나다.",
      color: "#8fbf9a",
      rewards: ["dokgo", "nokrim", "baekpa"],
      basic: {
        name: "산채도", school: "녹림", tag: "타격",
        steps: [
          { dmg: 26, range: 80, arc: 1.15, dur: 0.16, knock: 70 },
          { dmg: 32, range: 86, arc: 1.25, dur: 0.16, knock: 80 },
          { dmg: 48, range: 104, arc: 1.6, dur: 0.22, knock: 130, hitstop: 0.045 },
        ],
      },
      skills: [
        { key: "Q", name: "낙석", desc: "산비탈의 바위. 선 자리가 느려진다.", school: "녹림", tag: "타격", cd: 5, qi: 16, kind: "zone", dmg: 22, radius: 108, duration: 2.4, every: 0.45, statuses: [{ id: "둔화", t: 1.2 }] },
        { key: "W", name: "녹림함정", desc: "발밑의 함정. 선 자리에서 피가 샌다.", school: "녹림", tag: "출혈", cd: 5, qi: 16, kind: "zone", dmg: 16, radius: 104, duration: 3, every: 0.45, statuses: [{ id: "출혈", t: 3.5, stacks: 1 }] },
        { key: "E", name: "수로참", desc: "장강의 물결처럼 직선으로 베는 참격.", school: "수로", tag: "참격", cd: 4.4, qi: 16, kind: "proj", dmg: 58, count: 1, speed: 660, pierce: 6, spread: 0 },
        { key: "R", name: "대해소", desc: "최종 절기. 장강의 파도가 사방을 밀어낸다.", school: "수로", tag: "참격", cd: 11, qi: 38, kind: "nova", dmg: 150, radius: 140, knock: 200 },
      ],
    },
    {
      id: "akga",
      name: "오대 악가 전인",
      faction: "사파",
      factionId: "unorthodox",
      role: "5대 명문 혈맥형",
      title: "독고세가 · 단장검",
      power: 1,
      mechanic: "graft",
      summary: "혁련의 참과 백가의 독을 보조로 쓰고, 모용의 이화접목으로 적의 초식을 되돌린다. 최종 절기는 독고의 방어 무시 검.",
      color: "#d2c4ef",
      rewards: ["dokgo", "nokrim", "baekpa"],
      basic: {
        name: "독고검", school: "독고", tag: "검흔",
        steps: [
          { dmg: 24, range: 82, arc: 0.95, dur: 0.14, knock: 24 },
          { dmg: 32, range: 88, arc: 1.05, dur: 0.14, knock: 30 },
          { dmg: 50, range: 104, arc: 1.35, dur: 0.2, knock: 48, hitstop: 0.05 },
        ],
      },
      skills: [
        { key: "Q", name: "이화접목", desc: "잠시 적의 초식을 받아 같은 힘으로 되돌린다.", school: "모용", tag: "역공", cd: 7.5, qi: 16, kind: "counter", duration: 1.35 },
        { key: "W", name: "강시독", desc: "백가의 독이 발밑에서 퍼진다.", school: "백가", tag: "중독", cd: 5.2, qi: 16, kind: "zone", dmg: 14, radius: 104, duration: 2.8, every: 0.45, statuses: [{ id: "중독", t: 4, stacks: 1 }] },
        { key: "E", name: "혁련참", desc: "혁련의 큰 칼. 출혈이 깊게 남는다.", school: "혁련", tag: "출혈", cd: 4.6, qi: 18, kind: "arc", dmg: 70, range: 108, arc: 1.45, knock: 90, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
        { key: "R", name: "단장검", desc: "최종 절기. 독고의 검이 갑주를 무시하고 들어간다.", school: "독고", tag: "검흔", cd: 10, qi: 36, kind: "arc", dmg: 132, range: 112, arc: 1.15, knock: 40, armorPierce: true },
      ],
    },
    {
      id: "nangin",
      name: "낭인 세력",
      faction: "사파",
      factionId: "unorthodox",
      role: "특수 기믹 · 전환형",
      title: "천면변장",
      power: 1,
      mechanic: "mask",
      summary: "암살 낭인, 하오문, 떠돌이 검객을 객잔에서 오간다. 천면변장은 혈점을 돌려주고, 하오문은 전리품 안목이 있으며 암살은 약점을 본다.",
      color: "#cbb6ea",
      rewards: ["dokgo", "nokrim", "baekpa"],
      forms: [
        {
          id: "am",
          name: "암살 낭인",
          title: "암살 · 약점",
          summary: "등 뒤의 한 칼. 약점을 보면 치명타가 잦아진다.",
          color: "#d8c4ea",
          critBonus: 0.08,
          basic: {
            name: "비수", school: "낭인", tag: "출혈",
            steps: [
              { dmg: 22, range: 68, arc: 1.0, dur: 0.12, knock: 16, statuses: [{ id: "출혈", t: 3, stacks: 1 }] },
              { dmg: 28, range: 72, arc: 1.1, dur: 0.12, knock: 18, statuses: [{ id: "출혈", t: 3, stacks: 1 }] },
              { dmg: 44, range: 86, arc: 1.4, dur: 0.18, knock: 28, hitstop: 0.04, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
            ],
          },
          skills: [
            { key: "Q", name: "배후", desc: "가장 가까운 적의 뒤로 파고든다.", school: "낭인", tag: "암살", cd: 4.8, qi: 16, kind: "blink", dmg: 78, reach: 360 },
            { key: "W", name: "독침", desc: "짧은 독침.", school: "낭인", tag: "중독", cd: 4.4, qi: 14, kind: "proj", dmg: 34, count: 1, speed: 720, pierce: 2, spread: 0, statuses: [{ id: "중독", t: 4, stacks: 1 }] },
            { key: "E", name: "목베기", desc: "목을 노리는 짧은 베기.", school: "낭인", tag: "출혈", cd: 4.2, qi: 14, kind: "arc", dmg: 64, range: 78, arc: 0.9, knock: 20, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
            { key: "R", name: "일살", desc: "약점을 찍어 깊게 찌른다.", school: "낭인", tag: "암살", cd: 9, qi: 30, kind: "arc", dmg: 128, range: 84, arc: 0.7, knock: 10 },
          ],
        },
        {
          id: "hao",
          name: "하오문",
          title: "하오문 · 안목",
          summary: "정보의 그물. 싸움보다 주머니가 먼저 불어난다.",
          color: "#e4d7a8",
          dropBonus: 0.1,
          basic: {
            name: "정보검", school: "하오", tag: "검흔",
            steps: [
              { dmg: 20, range: 76, arc: 1.0, dur: 0.15, knock: 30 },
              { dmg: 26, range: 80, arc: 1.1, dur: 0.15, knock: 36 },
              { dmg: 38, range: 94, arc: 1.35, dur: 0.2, knock: 50, hitstop: 0.04 },
            ],
          },
          skills: [
            { key: "Q", name: "연막", desc: "연막 속에서 발을 늦춘다.", school: "하오", tag: "둔화", cd: 5, qi: 14, kind: "zone", dmg: 10, radius: 112, duration: 2.6, every: 0.45, statuses: [{ id: "둔화", t: 1.4 }] },
            { key: "W", name: "암기", desc: "주머니 속의 암기 셋.", school: "하오", tag: "암기", cd: 4.4, qi: 14, kind: "proj", dmg: 28, count: 3, speed: 640, pierce: 1, spread: 0.28 },
            { key: "E", name: "잠복", desc: "한 걸음 빠져 자리를 바꾼다.", school: "하오", tag: "보법", cd: 4.6, qi: 12, kind: "dash", dmg: 32, dist: 160 },
            { key: "R", name: "밀정", desc: "정보를 팔아 호신강기를 두르고 주변을 벤다.", school: "하오", tag: "정보", cd: 10, qi: 28, kind: "grace", dmg: 64, radius: 100, heal: 0.12 },
          ],
        },
        {
          id: "geom",
          name: "떠돌이 검객",
          title: "검객 · 일섬",
          summary: "문파 없는 검. 한 줄로 길게 벤다.",
          color: "#d5d0c6",
          basic: {
            name: "유검", school: "검객", tag: "검흔",
            steps: [
              { dmg: 26, range: 86, arc: 1.0, dur: 0.15, knock: 40 },
              { dmg: 34, range: 92, arc: 1.1, dur: 0.15, knock: 48 },
              { dmg: 52, range: 110, arc: 1.45, dur: 0.22, knock: 70, hitstop: 0.05 },
            ],
          },
          skills: [
            { key: "Q", name: "밟기", desc: "검 끝을 따라 파고든다.", school: "검객", tag: "검흔", cd: 4.2, qi: 14, kind: "dash", dmg: 58, dist: 180 },
            { key: "W", name: "평참", desc: "넓은 베기.", school: "검객", tag: "검흔", cd: 4.4, qi: 16, kind: "arc", dmg: 66, range: 108, arc: 1.5, knock: 70 },
            { key: "E", name: "검기", desc: "떨어져 나가는 한 줄의 검기.", school: "검객", tag: "검흔", cd: 4.8, qi: 16, kind: "proj", dmg: 64, count: 1, speed: 700, pierce: 4, spread: 0 },
            { key: "R", name: "일섬", desc: "갑주의 틈을 무시하는 한 칼.", school: "검객", tag: "검흔", cd: 10, qi: 32, kind: "arc", dmg: 118, range: 120, arc: 1.2, knock: 50, armorPierce: true },
          ],
        },
      ],
    },
  ],

  roster: [
    { characterId: "murim" },
    { characterId: "gupil" },
    { characterId: "hwangbo" },
    { characterId: "sinbi" },
    { characterId: "socheon" },
    { characterId: "magung" },
    { characterId: "maga" },
    { characterId: "hobub" },
    { characterId: "sapa" },
    { characterId: "noksu" },
    { characterId: "akga" },
    { characterId: "nangin" },
  ],
};

GANGHO.directions = [
  {
    id: "east", name: "동방 청룡", element: "목 · 뇌전 · 폭풍", color: "#7ec8c3", gimmick: "pillars",
    gimmickText: "뇌전 기둥을 먼저 부숴야 용린이 갈라진다.",
    raidName: "창해뇌신 청룡", raidReward: "ryongap",
    raidHint: "기둥 셋을 부순 뒤 용린을 깨면 그로기가 열린다.",
  },
  {
    id: "north", name: "북방 현무", element: "수 · 빙한 · 심연", color: "#9eb7d8", gimmick: "duo",
    gimmickText: "거북과 뱀을 함께 쓰러뜨려야 다시 일어나지 않는다.",
    raidName: "극한심연 현무", raidReward: "hancheol",
    raidHint: "한쪽만 쓰러지면 광폭화하며 되살아난다.",
  },
  {
    id: "west", name: "서방 백호", element: "금 · 참격 · 출혈", color: "#e4c6a0", gimmick: "bleed",
    gimmickText: "출혈이 다섯 겹이 되기 전에 경공으로 끊어라.",
    raidName: "살성패왕 백호", raidReward: "mukcham",
    raidHint: "살성의 난무. 출혈 다섯 겹은 경공으로만 끊긴다.",
  },
  {
    id: "south", name: "남방 주작", element: "화 · 태양 · 불사", color: "#e08a62", gimmick: "egg",
    gimmickText: "쓰러지면 불사의 알이 된다. 부화하기 전에 깨라.",
    raidName: "열반화조 주작", raidReward: "bongui",
    raidHint: "불사의 알을 제한 시간 안에 부수지 못하면 다시 난다.",
  },
];

GANGHO.mansions = [
  ["east", "각", "각목교", "산해경의 교룡"],
  ["east", "항", "항금룡", "서유기의 뿔용"],
  ["east", "저", "저수", "동방의 별자리"],
  ["east", "방", "방수", "동방의 별자리"],
  ["east", "심", "심월호", "구미호의 매혹"],
  ["east", "미", "미수", "동방의 별자리"],
  ["east", "기", "기수표", "만파식적의 폭풍"],
  ["north", "두", "두목해", "신수 해태"],
  ["north", "우", "우금우", "서유기의 우마왕"],
  ["north", "녀", "녀수", "북방의 별자리"],
  ["north", "허", "허수", "북방의 별자리"],
  ["north", "위", "위수", "북방의 별자리"],
  ["north", "실", "실화저", "산해경의 봉희"],
  ["north", "벽", "벽수유", "아홉 머리의 독수"],
  ["west", "규", "규목랑", "서유기의 황포괴"],
  ["west", "루", "루금구", "산해경의 천구"],
  ["west", "위", "위수", "서방의 별자리"],
  ["west", "묘", "묘일계", "서유기의 묘일성관"],
  ["west", "필", "필수", "서방의 별자리"],
  ["west", "자", "자화후", "육이미후의 그림자"],
  ["west", "삼", "삼수", "서방의 별자리"],
  ["south", "정", "정목한", "산해경의 화두"],
  ["south", "귀", "귀금양", "도철의 굶주림"],
  ["south", "유", "유수", "남방의 별자리"],
  ["south", "성", "성일마", "삼국유사의 천마"],
  ["south", "장", "장월록", "환영을 고치는 사슴"],
  ["south", "익", "익수", "남방의 별자리"],
  ["south", "진", "진수", "남방의 별자리"],
].map((row) => ({
  id: row[0] + "-" + row[1],
  dir: row[0],
  star: row[1],
  name: row[2],
  lore: row[3],
  time: 120,
}));

const JEWEL_FX = {
  east: { crit: 0.06 },
  north: { armor: 8, hp: 18 },
  west: { lifesteal: 0.04, crit: 0.03 },
  south: { dmg: 0.08, qiRegen: 2 },
};
const JEWEL_DESC = {
  east: "청룡의 별. 치명타가 잦아진다.",
  north: "현무의 별. 살이 두텁고 방어가 붙는다.",
  west: "백호의 별. 벤 상처를 피로 되돌린다.",
  south: "주작의 별. 무공이 뜨겁고 내공이 돌아온다.",
};
for (const m of GANGHO.mansions) {
  GANGHO.items["jewel_" + m.id] = Object.assign({
    name: m.star + "수 주얼",
    slot: "jewel",
    grade: 4,
    desc: m.name + ". " + JEWEL_DESC[m.dir],
  }, JEWEL_FX[m.dir]);
}

GANGHO.heavens = [
  {
    id: "namdu",
    name: "남두육성",
    element: "생 · 탄생 · 과잉 치유",
    color: "#f0d28a",
    gimmick: "regen",
    gimmickText: "생의 기둥을 부수기 전에는 쓰러진 몸이 더 강하게 되살아난다.",
    trials: [
      ["1", "일성", "탄생의 문"],
      ["2", "이성", "양육의 빛"],
      ["3", "삼성", "과잉의 살"],
      ["4", "사성", "재생의 고리"],
      ["5", "오성", "변이의 문"],
      ["6", "육성", "남두주생"],
    ],
  },
  {
    id: "bukdu",
    name: "북두칠성",
    element: "사 · 죽음 · 업보",
    color: "#c9b6f2",
    gimmick: "fate",
    gimmickText: "생사부 각인이 떨어지기 전에 기둥을 부숴 수명을 되돌려라.",
    trials: [
      ["tam", "탐랑", "살기를 여는 별"],
      ["geom", "거문", "문을 닫는 별"],
      ["nok", "녹존", "녹을 재는 별"],
      ["mun", "문곡", "글을 거두는 별"],
      ["yeom", "염정", "업을 정하는 별"],
      ["mu", "무곡", "무를 베는 별"],
      ["pa", "파군", "군세를 부수는 별"],
    ],
  },
].map((h) => ({
  id: h.id,
  name: h.name,
  element: h.element,
  color: h.color,
  gimmick: h.gimmick,
  gimmickText: h.gimmickText,
  trials: h.trials.map((row) => ({
    id: h.id + "-" + row[0],
    heaven: h.id,
    star: row[1],
    name: row[2],
    time: 130,
  })),
}));

GANGHO.items.saenggyeong = {
  name: "생사경 · 생", slot: "charm", grade: 5,
  desc: "남두의 쪽. 숨이 길어지고 영약이 진해진다.", hp: 42, potion: 0.12,
};
GANGHO.items.sagyeong = {
  name: "생사경 · 사", slot: "charm", grade: 5,
  desc: "북두의 쪽. 끝맺음이 날카로워진다.", dmg: 0.16, crit: 0.06,
};
GANGHO.items.taeilpae = {
  name: "태일패", slot: "jewel", grade: 5,
  desc: "북극성의 패. 자미 성좌가 무공과 내공을 함께 끌어올린다.", dmg: 0.1, qi: 22, qiRegen: 3,
};

GANGHO.ores = [
  { id: "saeng", name: "생철" },
  { id: "white", name: "백철" },
  { id: "muk", name: "묵철" },
  { id: "bidan", name: "비단" },
  { id: "han", name: "만년한철" },
];

GANGHO.oreDrop = {
  grunt: [["saeng", 0.72], ["bidan", 0.34]],
  thrower: [["white", 0.48], ["bidan", 0.5]],
  elite: [["muk", 0.62], ["bidan", 0.28]],
  boss: [["han", 1], ["muk", 0.55]],
};

GANGHO.scrap = {
  1: { saeng: 2 },
  2: { saeng: 2, white: 1 },
  3: { muk: 2, bidan: 1 },
};

GANGHO.recipes = [
  { item: "iron", cost: { saeng: 6 }, text: "생철을 두드려 날을 세운다." },
  { item: "baek", cost: { white: 4, saeng: 2 }, text: "백철로 가벼운 도를 벼린다." },
  { item: "hwando", cost: { saeng: 8, white: 2 }, text: "고리 자루의 큰 칼." },
  { item: "muk", cost: { muk: 4 }, text: "묵철은 호신강기를 파쇄한다." },
  { item: "cloth", cost: { bidan: 4 }, text: "거친 삼베를 겹친다." },
  { item: "silk", cost: { bidan: 6, saeng: 2 }, text: "항주 비단을 철과 함께 겹친다." },
  { item: "snow", cost: { bidan: 5, white: 2 }, text: "가벼운 가죽을 여민다." },
  { item: "jade", cost: { white: 3, bidan: 3 }, text: "옥패에 비단 끈을 맨다." },
  { item: "mongol", cost: { bidan: 8, muk: 2 }, text: "몽골 비단과 묵철을 겹친다." },
  { item: "charm", cost: { muk: 3, bidan: 4 }, text: "영수의 조각을 호신부로 묶는다." },
  { item: "bottle", cost: { bidan: 6, han: 1 }, text: "만년한철 한 줌으로 호리병을 봉한다." },
];

Object.assign(GANGHO.items, {
  yodo: { name: "요도", slot: "weapon", grade: 4, desc: "동영의 외날 도. 치명과 베는 힘이 함께 오른다.", dmg: 0.22, crit: 0.05 },
  gakgung: { name: "각궁의 줄", slot: "charm", grade: 4, desc: "초원의 활시위. 손과 눈이 빨라진다.", crit: 0.04, aspd: 0.08 },
  bingpae: { name: "빙궁 패갑", slot: "armor", grade: 4, desc: "북해의 얼음 갑옷. 살이 두텁다.", armor: 14, hp: 18 },
  hyeolju: { name: "혈교 주령", slot: "charm", grade: 4, desc: "벤 상처를 피로 되돌리는 주령.", lifesteal: 0.08 },
  vajra: { name: "금강저", slot: "weapon", grade: 4, desc: "서장 밀교의 저. 갑주를 밀어붙인다.", dmg: 0.16, armor: 8 },
  yasu: { name: "야수왕의 가죽", slot: "armor", grade: 4, desc: "남만의 가죽. 숨통이 길다.", hp: 40 },
  halfwill: { name: "반쪽 유언", slot: "charm", grade: 4, desc: "가면 뒤에 남은 스승의 말. 내공과 위력이 오른다.", qi: 20, dmg: 0.1 },
  suin: { name: "산해의 이빨", slot: "weapon", grade: 5, desc: "봉인된 흉수의 이빨. 신화의 날.", dmg: 0.3, crit: 0.04 },
});

GANGHO.characters.push(
  {
    id: "chiu",
    name: "치우가 광전사",
    faction: "세외",
    factionId: "demonic",
    role: "잃은 피의 광폭",
    title: "치우강림",
    power: 1,
    mechanic: "rage",
    summary: "북극성을 닫은 뒤에 비급이 도착한다. 생명이 줄어들수록 초식이 무거워진다. 빈 피로 싸우는 전사의 길.",
    color: "#c45a3a",
    rewards: ["yodo", "vajra", "hyeolma"],
    basic: {
      name: "치우삼격",
      school: "치우",
      tag: "타격",
      steps: [
        { dmg: 30, range: 86, arc: 1.15, dur: 0.17, knock: 80 },
        { dmg: 38, range: 92, arc: 1.25, dur: 0.17, knock: 100 },
        { dmg: 54, range: 104, arc: 1.6, dur: 0.26, knock: 160, hitstop: 0.05 },
      ],
    },
    skills: [
      { key: "Q", name: "파천격", desc: "도끼를 크게 내리친다.", school: "치우", tag: "타격", cd: 4.4, qi: 16, kind: "arc", dmg: 78, range: 108, arc: 1.3, knock: 150 },
      { key: "W", name: "혈풍", desc: "잃은 피의 바람. 출혈을 남긴다.", school: "치우", tag: "출혈", cd: 5.2, qi: 18, kind: "arc", dmg: 64, range: 112, arc: 1.5, knock: 60, statuses: [{ id: "출혈", t: 4, stacks: 2 }] },
      { key: "E", name: "광호", desc: "짧게 뛰어들며 벤다.", school: "치우", tag: "타격", cd: 6, qi: 14, kind: "dash", dmg: 70, dist: 160, knock: 120 },
      { key: "R", name: "치우강림", desc: "주변의 적을 도끼 폭풍으로 밀어낸다.", school: "치우", tag: "타격", cd: 10, qi: 36, kind: "nova", dmg: 132, radius: 124, knock: 210 },
    ],
  },
  {
    id: "haedong",
    name: "해동무림 삼재",
    faction: "세외",
    factionId: "orthodox",
    role: "천·지·인",
    title: "삼재합일",
    power: 1,
    mechanic: "samjae",
    summary: "북극성을 닫은 뒤에 비급이 도착한다. 초식을 세 번 이으면 천·지·인이 한 박자로 터진다.",
    color: "#d7c27a",
    rewards: ["songmun", "cheongryong", "suin"],
    basic: {
      name: "삼재검",
      school: "해동",
      tag: "검흔",
      steps: [
        { dmg: 26, range: 84, arc: 1.0, dur: 0.15, knock: 50 },
        { dmg: 34, range: 88, arc: 1.1, dur: 0.15, knock: 60 },
        { dmg: 46, range: 100, arc: 1.4, dur: 0.22, knock: 120 },
      ],
    },
    skills: [
      { key: "Q", name: "천검", desc: "하늘에서 떨어지는 검기.", school: "천", tag: "검흔", cd: 4.6, qi: 16, kind: "bolt", dmg: 70, range: 160 },
      { key: "W", name: "지창", desc: "땅을 가르는 창. 적을 밀어낸다.", school: "지", tag: "타격", cd: 5, qi: 18, kind: "arc", dmg: 68, range: 118, arc: 0.7, knock: 180 },
      { key: "E", name: "인보", desc: "사람의 보법. 짧게 자리를 옮긴다.", school: "인", tag: "경공", cd: 5.4, qi: 12, kind: "blink", dmg: 28, reach: 220 },
      { key: "R", name: "삼재합일", desc: "세 번째 초식의 여운을 한 번에 터뜨린다.", school: "해동", tag: "검흔", cd: 9.5, qi: 32, kind: "nova", dmg: 118, radius: 120, knock: 160 },
    ],
  }
);

GANGHO.dlc = [
  { characterId: "chiu" },
  { characterId: "haedong" },
];

GANGHO.frontier = [
  { id: "dong", name: "동영", boss: "동영검후", color: "#d24a4a", gimmick: "bleed", hint: "발도가 빠르다. 출혈이 다섯 겹이기 전에 경공으로 끊어라.", lore: "동쪽 바다의 검객들이 관문을 넘는다. 그들의 도는 한 번에 깊게 베도록 벼려져 있다.", reward: "yodo", time: 140, danger: 1.22, hp: 1.05 },
  { id: "cho", name: "초원", boss: "대막궁수", color: "#c4a15a", gimmick: null, hint: "활을 든 무리가 멀리서 쏟아진다. 거리를 먼저 지워라.", lore: "초원의 기마가 비단과 각궁을 싣고 왔다. 말발굽보다 화살이 먼저 닿는다.", reward: "gakgung", time: 140, danger: 1.22, hp: 1.08 },
  { id: "bukhae", name: "북해빙궁", boss: "빙궁주", color: "#9ec4e0", gimmick: null, hint: "얼음 갑옷이 두텁다. 내상으로 갑주를 먼저 헐라.", lore: "북해의 궁전이 안개를 밀고 내려온다. 추위보다 갑주가 먼저 사람을 막는다.", reward: "bingpae", time: 150, danger: 1.28, hp: 1.2 },
  { id: "hyeolgyo", name: "혈교", boss: "혈교주", color: "#8a2030", gimmick: "regen", hint: "생의 기둥을 끊기 전에 수장을 베면 몸이 되살아난다.", lore: "피를 신앙으로 삼는 교단. 생의 기둥이 서 있는 한 그들의 상처는 아문다.", reward: "hyeolju", time: 150, danger: 1.3, hp: 1.12 },
  { id: "milgyo", name: "서장 밀교", boss: "금강행자", color: "#d7c27a", gimmick: null, hint: "금강저는 가깝고 무겁다. 거리를 재며 쳐라.", lore: "서장의 행자가 금강저를 들고 관문에 섰다. 주문을 외는 동안에도 저가 먼저 떨어진다.", reward: "vajra", time: 150, danger: 1.3, hp: 1.18 },
  { id: "namman", name: "남만야수궁", boss: "야수왕", color: "#6a8f4e", gimmick: "egg", hint: "첫 번째 죽음은 알이 된다. 알을 깨야 관문이 닫힌다.", lore: "남만의 야수가 사람의 관문을 짐승의 우리로 바꾸려 한다. 죽인 몸이 알로 남으면 아직 끝이 아니다.", reward: "yasu", time: 150, danger: 1.28, hp: 1.15 },
  { id: "mask", name: "흑막", boss: "옛 사제", color: "#c9b6a0", gimmick: null, gate: "gates", seal: "mask", hint: "여섯 관문을 닫은 뒤에야 가면이 벗겨진다.", lore: "여동빈의 옛 사제. 세외를 한 줄로 묶은 손이 객잔의 등 뒤에서 웃고 있었다.", reward: "halfwill", time: 160, danger: 1.4, hp: 1.28 },
  { id: "sanhae", name: "산해경", boss: "태고흉수", color: "#e0c36a", gimmick: "regen", gate: "mask", seal: "sanhae", hint: "생의 기둥을 끊어야 흉수의 변이가 멈춘다.", lore: "산과 바다의 기록에서 풀려난 흉수. 생이 남아 있으면 이빨이 다시 자란다.", reward: "suin", time: 170, danger: 1.5, hp: 1.4 },
];

GANGHO.gems = [
  { id: "yeol", name: "분열 구결", cost: { saeng: 4 }, desc: "투사체가 하나 늘거나, 베기와 파동이 넓어진다." },
  { id: "hyeol", name: "출혈 구결", cost: { bidan: 4 }, desc: "초식에 출혈 한 겹을 새긴다." },
  { id: "gwan", name: "관통 구결", cost: { muk: 3 }, desc: "이 초식은 갑주를 무시한다." },
  { id: "heup", name: "흡혈 구결", cost: { white: 4 }, desc: "입힌 피해의 일부를 피로 되돌린다." },
];
