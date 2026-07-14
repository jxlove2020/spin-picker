const COLORS = [
  '#FF6B6B',
  '#FF8E53',
  '#FFC857',
  '#2EC4B6',
  '#3A86FF',
  '#8338EC',
  '#FF006E',
  '#06D6A0',
  '#FFBE0B',
  '#118AB2',
  '#F72585',
  '#7209B7',
  '#4CC9F0',
  '#4895EF',
  '#43AA8B',
  '#F94144',
  '#F3722C',
  '#90BE6D',
  '#577590',
  '#277DA1',
];

const STORAGE_KEY = 'picker-data';

const PRESETS = {
  church_food: {
    title: '교회근처 식당',
    items: ['돈까스', '초밥', '칼국수', '롯데리아', '김밥', '순대국', '뼈해장국', '냉면'],
  },
};

const GRAVITY = 0.045;
const RESTITUTION = 0.72;
const FRICTION_X = 0.992;
const MAX_SPEED = 3.2;
const FINISH_MARGIN = 10;
const STAGE_COUNT = 3;
const STAGE_TYPES = ['field', 'windmill', 'gate', 'funnel'];
const STAGE_TINT = {
  field: 'rgba(34,211,238,0.05)',
  windmill: 'rgba(251,146,60,0.08)',
  gate: 'rgba(168,85,247,0.08)',
  funnel: 'rgba(96,165,250,0.09)',
};
const STAGE_ICON = { field: '💎', windmill: '🌀', gate: '🚪', funnel: '⏳' };

/* ════════════════════════════
   DOM
════════════════════════════ */
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const logo = document.getElementById('logo');
const titleMain = document.getElementById('titleMain');
const titleSub = document.getElementById('titleSub');
const verSpin = document.getElementById('verSpin');
const verPinball = document.getElementById('verPinball');
const btnAction = document.getElementById('btnAction');
const btnApply = document.getElementById('btnApply');
const btnSave = document.getElementById('btnSave');
const btnReset = document.getElementById('btnReset');
const btnLoadPreset = document.getElementById('btnLoadPreset');
const presetSelect = document.getElementById('presetSelect');
const slotsList = document.getElementById('slotsList');
const slotCountInput = document.getElementById('slotCount');
const resultBox = document.getElementById('resultBox');
const resultLabel = document.getElementById('resultLabel');
const resultValue = document.getElementById('resultValue');
const saveMsg = document.getElementById('saveMsg');
const settingsSection = document.getElementById('settingsSection');
const sheetHandleBar = document.getElementById('sheetHandleBar');
const backdrop = document.getElementById('backdrop');
const btnSettings = document.getElementById('btnSettings');
const settingsDrop = document.getElementById('settingsDropdown');
const menuClearCache = document.getElementById('menuClearCache');
const menuReset = document.getElementById('menuReset');
const btnCloseSheet = document.getElementById('btnCloseSheet');
const lblSlotSection = document.getElementById('lblSlotSection');
const lblSlotCount = document.getElementById('lblSlotCount');
const lblItemsSection = document.getElementById('lblItemsSection');

/* ════════════════════════════
   상태
════════════════════════════ */
let mode = 'spin'; // 'spin' | 'pinball'
let W, H;
let slots = [];
let animFrame = null;

let CX, CY, R;
let currentAngle = 0;
let spinning = false;

let BALL_R, PEG_R, MARGIN;
let currentMap = 'classic'; // 'classic' | 'random' | 'bumper'
let pegs = [];
let racers = [];
let particles = [];
let bgSquares = [];
let hitPegs = new Map();
let raceWinner = null;
let raceEndT = 0;
let racing = false;
let idleFrame = null;
let FUNNEL_TOP, FUNNEL_NECK_Y, FUNNEL_OPEN_Y, FIELD_BOT, STAGE_H, WORLD_H;
let funnelWalls = [],
  funnelNeckHalf = 0;
let stages = [],
  midWalls = [];
let scrollY = 0;
let bgGradient = null,
  _bgH = -1;

/* ════════════════════════════
   모드 전환
════════════════════════════ */
function applyModeUI() {
  const isPinball = mode === 'pinball';
  document.body.classList.toggle('mode-pinball', isPinball);
  verSpin.classList.toggle('active', !isPinball);
  verPinball.classList.toggle('active', isPinball);
  logo.textContent = isPinball ? '🎪' : '🎡';
  titleMain.childNodes[0].textContent = isPinball ? 'Pinball Picker ' : 'Spin Picker ';
  titleSub.textContent = isPinball ? '핀볼 뽑기' : '뽑기판';
  btnAction.textContent = isPinball ? '🏁 레이스 시작!' : '▶ 돌리기!';
  document.title = isPinball ? 'Pinball Picker · 핀볼 뽑기' : 'Spin Picker · 뽑기판';
  lblSlotSection.textContent = isPinball ? '참가자 수 설정' : '칸 수 설정';
  lblSlotCount.textContent = isPinball ? '참가자 수' : '칸 수';
  lblItemsSection.textContent = isPinball ? '참가자 이름' : '항목 입력';
  slotCountInput.max = isPinball ? 10 : 20;
}

function setMode(newMode) {
  if (mode === newMode) return;
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  stopIdleLoop();
  spinning = racing = false;
  racers = [];
  particles = [];
  bgSquares = [];
  raceWinner = null;
  btnAction.disabled = false;
  resultBox.className = 'result-box';
  mode = newMode;
  saveData();
  applyModeUI();
  /* 핀볼 모드에서는 슬롯 수 최대 10 */
  if (mode === 'pinball' && slots.length > 10) {
    buildSlots(10, slots.map(s => s.label).slice(0, 10));
    slotCountInput.value = 10;
    renderInputs();
  }
  resizeCanvas();
  if (mode === 'pinball') startIdleLoop();
}

verSpin.addEventListener('click', () => setMode('spin'));
verPinball.addEventListener('click', () => setMode('pinball'));
verSpin.addEventListener('keydown', e => e.key === 'Enter' && setMode('spin'));
verPinball.addEventListener('keydown', e => e.key === 'Enter' && setMode('pinball'));

document.querySelectorAll('.map-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (racing) return;
    document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMap = btn.dataset.map;
    resetRaceState();
    buildPegs();
    drawBoard();
  });
});

/* ════════════════════════════
   바텀 시트
════════════════════════════ */
function isMobile() {
  return window.innerWidth < 741;
}
function openSheet() {
  settingsSection.classList.add('open');
  backdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  settingsSection.classList.remove('open');
  backdrop.classList.remove('visible');
  document.body.style.overflow = '';
}

sheetHandleBar.addEventListener('click', () => {
  if (!isMobile()) return;
  settingsSection.classList.contains('open') ? closeSheet() : openSheet();
});
backdrop.addEventListener('click', closeSheet);
btnCloseSheet.addEventListener('click', e => {
  e.stopPropagation();
  closeSheet();
});

/* ════════════════════════════
   캔버스 리사이즈
════════════════════════════ */
function resizeCanvas() {
  let cw, ch;
  if (mode === 'spin') {
    if (isMobile()) {
      cw = Math.min(Math.max(window.innerWidth - 48, 260), 460);
    } else {
      const availH = Math.min(window.innerHeight, 1000) - 292;
      const availW = window.innerWidth - 432;
      cw = Math.min(Math.max(Math.min(availH, availW), 260), 460);
    }
    ch = cw;
  } else {
    if (isMobile()) {
      cw = Math.min(Math.max(window.innerWidth - 40, 260), 400);
      ch = Math.round(cw * 1.55);
    } else {
      const availH = Math.min(window.innerHeight, 1000) - 300;
      const availW = window.innerWidth - 432;
      ch = Math.min(Math.max(Math.min(availH, Math.round(availW * 1.55)), 320), 620);
      cw = Math.round(ch / 1.55);
    }
  }
  canvas.width = cw;
  canvas.height = ch;
  W = cw;
  H = ch;

  if (mode === 'spin') {
    CX = W / 2;
    CY = H / 2;
    R = CX - 20;
  } else {
    rebuildPinball(slots.length || 1);
    scrollY = 0;
  }
  drawBoard();
}

/* ════════════════════════════
   공통 그리기 진입점
════════════════════════════ */
function drawBoard() {
  if (mode === 'spin') drawWheel();
  else drawPinball();
}

/* ════════════════════════════
   SPIN: 휠 그리기
════════════════════════════ */
function drawWheel() {
  if (!CX) return;
  ctx.clearRect(0, 0, W, H);
  if (!slots.length) return;

  const arc = (Math.PI * 2) / slots.length;

  ctx.beginPath();
  ctx.arc(CX, CY, R + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  slots.forEach((s, i) => {
    const startAngle = currentAngle + arc * i - Math.PI / 2;
    const endAngle = startAngle + arc;

    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.arc(CX, CY, R, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(startAngle + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    const label = s.label || `항목 ${i + 1}`;
    const fontSize = Math.min(16, Math.max(9, Math.floor((R * arc) / (label.length * 1.3 + 1))));
    ctx.font = `bold ${fontSize}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(label, R - 10, fontSize / 3, R - 28);
    ctx.restore();
  });

  const grad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 30);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(1, '#d1d5db');
  ctx.beginPath();
  ctx.arc(CX, CY, 30, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = `${Math.max(16, Math.floor(R * 0.12))}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎯', CX, CY);
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 4);
}

function spin() {
  if (spinning || !slots.length) return;
  spinning = true;
  btnAction.disabled = true;
  resultBox.className = 'result-box';

  const totalRot = Math.PI * 2 * (5 + Math.random() * 5);
  const duration = 4000 + Math.random() * 1500;
  const start = currentAngle;
  const t0 = performance.now();

  function frame(now) {
    const progress = Math.min((now - t0) / duration, 1);
    currentAngle = start + totalRot * easeOut(progress);
    drawWheel();
    if (progress < 1) {
      animFrame = requestAnimationFrame(frame);
    } else {
      animFrame = null;
      spinning = false;
      btnAction.disabled = false;
      showSpinResult();
    }
  }
  animFrame = requestAnimationFrame(frame);
}

function showSpinResult() {
  const arc = (Math.PI * 2) / slots.length;
  const normalized = ((-(currentAngle - Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.floor(normalized / arc) % slots.length;
  const w = slots[index];
  showResult(w.label || `항목 ${index + 1}`, w.color);
}

/* ════════════════════════════
   PINBALL: 깔때기(퍼널)
════════════════════════════ */
function computeFunnelWalls() {
  const cx = W / 2;
  const half = Math.max(BALL_R * 2.2, (W - MARGIN * 2) * 0.15);
  funnelNeckHalf = half;
  funnelWalls = [
    { x1: cx - half, y1: FUNNEL_TOP, x2: cx - half, y2: FUNNEL_NECK_Y },
    { x1: cx + half, y1: FUNNEL_TOP, x2: cx + half, y2: FUNNEL_NECK_Y },
    { x1: cx - half, y1: FUNNEL_NECK_Y, x2: MARGIN, y2: FUNNEL_OPEN_Y },
    { x1: cx + half, y1: FUNNEL_NECK_Y, x2: W - MARGIN, y2: FUNNEL_OPEN_Y },
  ];
  /* 지그재그 장애물은 넣지 않음: 짧은 대각선은 공이 끝점에 걸려 멈추는 문제가 있어
     깔때기 옆벽만으로 좁은 통로를 만들고, 공끼리 부딪히며 자연스럽게 순서가 섞이게 한다 */
}

/* ════════════════════════════
   PINBALL: 스테이지 & 페그 배치
════════════════════════════ */
function buildStages() {
  stages = [];
  let y = FUNNEL_OPEN_Y + 10;
  const pool = STAGE_TYPES.filter(t => t !== 'field').sort(() => Math.random() - 0.5);
  for (let i = 0; i < STAGE_COUNT; i++) {
    const type = i === 0 ? 'field' : pool[i - 1];
    stages.push({ type, top: y, bot: y + STAGE_H });
    y += STAGE_H;
  }
  FIELD_BOT = y;
  WORLD_H = FIELD_BOT + FINISH_MARGIN + 20;
}

function buildPegs() {
  pegs = [];
  midWalls = [];
  if (!slots.length) return;
  buildStages();
  stages.forEach(stage => {
    if (stage.type === 'windmill') buildWindmillStage(stage);
    else if (stage.type === 'gate') buildGateStage(stage);
    else if (stage.type === 'funnel') buildFunnelStage(stage);
    else buildFieldStage(stage);
  });
  updateDynamicPegs(performance.now());
}

function rebuildPinball(count) {
  MARGIN = Math.round(W * 0.055);
  const slotW = (W - MARGIN * 2) / Math.max(1, count);
  BALL_R = Math.max(4, Math.min(10, Math.floor(slotW / 6)));
  PEG_R = Math.max(3, Math.round(BALL_R * 0.6));
  FUNNEL_TOP = 14;
  FUNNEL_NECK_Y = Math.round(H * 0.11);
  FUNNEL_OPEN_Y = Math.round(H * 0.27);
  STAGE_H = Math.round(H * 0.55);
  computeFunnelWalls();
  buildPegs();
}

function resetRaceState() {
  raceWinner = null;
  racers = [];
  scrollY = 0;
}

function buildFieldStage(stage) {
  const N = slots.length;
  const usableW = W - MARGIN * 2;
  const areaTop = stage.top + 14,
    areaBot = stage.bot - 14;
  if (currentMap === 'random') {
    const target = N * 3;
    const minGap = (BALL_R + PEG_R) * 2.8;
    let tries = 0;
    while (tries < 500) {
      tries++;
      const x = MARGIN + minGap + Math.random() * (usableW - minGap * 2);
      const y = areaTop + Math.random() * (areaBot - areaTop);
      if (pegs.every(p => Math.hypot(p.x - x, p.y - y) >= minGap)) {
        pegs.push({ x, y, type: 'normal' });
        if (pegs.filter(p => p.y >= areaTop && p.y <= areaBot).length >= target) break;
      }
    }
    return;
  }
  const slotW = usableW / N;
  const rows = Math.max(3, Math.round((areaBot - areaTop) / (slotW * 0.9)));
  const rowH = (areaBot - areaTop) / (rows - 1);
  for (let row = 0; row < rows; row++) {
    const y = areaTop + row * rowH;
    if (row % 2 === 0) {
      for (let col = 0; col < N; col++) pegs.push({ x: MARGIN + slotW * (col + 0.5), y, type: 'normal' });
    } else {
      for (let col = 0; col < N - 1; col++) pegs.push({ x: MARGIN + slotW * (col + 1), y, type: 'normal' });
    }
  }
  if (currentMap === 'bumper') {
    const midY = areaTop + (areaBot - areaTop) * 0.55;
    const cx = W / 2,
      bOff = usableW * 0.22;
    pegs.push({ x: cx, y: midY - (areaBot - areaTop) * 0.14, type: 'bumper' });
    pegs.push({ x: cx - bOff, y: midY + (areaBot - areaTop) * 0.1, type: 'bumper' });
    pegs.push({ x: cx + bOff, y: midY + (areaBot - areaTop) * 0.1, type: 'bumper' });
  }
}

function buildWindmillStage(stage) {
  const cx = W / 2;
  const midY = (stage.top + stage.bot) / 2;
  const usableW = W - MARGIN * 2;
  const radius = Math.min(usableW, STAGE_H) * 0.32;
  const bladeCount = 3;
  const speed = (Math.random() < 0.5 ? 1 : -1) * (1.1 + Math.random() * 0.7);
  for (let b = 0; b < bladeCount; b++) {
    pegs.push({
      x: cx,
      y: midY,
      type: 'windmill-blade',
      hub: b === 0,
      motion: { kind: 'spin', cx, cy: midY, radius, angle0: b * ((2 * Math.PI) / bladeCount), speed },
    });
  }
  /* 위아래 고정 페그로 공이 날개 쪽으로 유도되게 함 */
  pegs.push({ x: MARGIN + usableW * 0.2, y: stage.top + STAGE_H * 0.2, type: 'normal' });
  pegs.push({ x: MARGIN + usableW * 0.8, y: stage.top + STAGE_H * 0.2, type: 'normal' });
  pegs.push({ x: MARGIN + usableW * 0.2, y: stage.bot - STAGE_H * 0.2, type: 'normal' });
  pegs.push({ x: MARGIN + usableW * 0.8, y: stage.bot - STAGE_H * 0.2, type: 'normal' });
}

function buildGateStage(stage) {
  const midY = (stage.top + stage.bot) / 2;
  const usableW = W - MARGIN * 2;
  const amp = usableW * 0.16;
  const speed = 1.0 + Math.random() * 0.5;
  const halfW = PEG_R * 5;
  const halfH = PEG_R * 1.6;
  const glowR = halfW;
  pegs.push({
    x: 0,
    y: midY,
    type: 'gate',
    glowR,
    halfW,
    halfH,
    motion: { kind: 'slide', baseX: MARGIN + usableW * 0.28, amplitude: amp, speed, phase: 0 },
  });
  pegs.push({
    x: 0,
    y: midY,
    type: 'gate',
    glowR,
    halfW,
    halfH,
    motion: { kind: 'slide', baseX: MARGIN + usableW * 0.72, amplitude: amp, speed, phase: Math.PI },
  });
  /* 위쪽 페그로 공이 중앙으로 모이게 유도 */
  pegs.push({ x: W / 2 - usableW * 0.22, y: stage.top + STAGE_H * 0.18, type: 'normal' });
  pegs.push({ x: W / 2 + usableW * 0.22, y: stage.top + STAGE_H * 0.18, type: 'normal' });
}

function buildFunnelStage(stage) {
  const cx = W / 2;
  const neckHalf = Math.max(BALL_R * 2.4, (W - MARGIN * 2) * 0.12);
  const topY = stage.top + 14;
  const neckY = stage.top + STAGE_H * 0.42;
  const neckY2 = Math.min(neckY + STAGE_H * 0.3, stage.bot - 30);
  const openY = stage.bot - 12;
  midWalls.push(
    { x1: MARGIN, y1: topY, x2: cx - neckHalf, y2: neckY },
    { x1: W - MARGIN, y1: topY, x2: cx + neckHalf, y2: neckY },
    { x1: cx - neckHalf, y1: neckY, x2: cx - neckHalf, y2: neckY2 },
    { x1: cx + neckHalf, y1: neckY, x2: cx + neckHalf, y2: neckY2 },
    { x1: cx - neckHalf, y1: neckY2, x2: MARGIN, y2: openY },
    { x1: cx + neckHalf, y1: neckY2, x2: W - MARGIN, y2: openY },
  );
}

function updateDynamicPegs(now) {
  pegs.forEach(p => {
    if (!p.motion) return;
    if (p.motion.kind === 'spin') {
      const ang = p.motion.angle0 + now * 0.001 * p.motion.speed;
      p.x = p.motion.cx + Math.cos(ang) * p.motion.radius;
      p.y = p.motion.cy + Math.sin(ang) * p.motion.radius;
    } else if (p.motion.kind === 'slide') {
      p.x = p.motion.baseX + Math.sin(now * 0.001 * p.motion.speed + p.motion.phase) * p.motion.amplitude;
    }
  });
}

/* ════════════════════════════
   PINBALL: 파티클
════════════════════════════ */
function spawnParticles(x, y, nx, ny, isBumper) {
  const count = isBumper ? 12 : 5;
  const base = Math.atan2(ny, nx);
  for (let i = 0; i < count; i++) {
    const a = base + (Math.random() - 0.5) * (isBumper ? Math.PI * 2 : Math.PI * 0.9);
    const spd = (isBumper ? 2.8 : 1.3) + Math.random() * (isBumper ? 2 : 1.5);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - (isBumper ? 1 : 0.4),
      life: 1.0,
      decay: isBumper ? 0.03 : 0.052,
      r: isBumper ? 3 : 2,
      color: isBumper ? '#fb923c' : '#a78bfa',
    });
  }
}

/* ════════════════════════════
   PINBALL: 그리기
════════════════════════════ */
function drawPinball() {
  ctx.clearRect(0, 0, W, H);

  if (_bgH !== H) {
    bgGradient = ctx.createLinearGradient(0, 0, 0, H);
    bgGradient.addColorStop(0, '#0c1035');
    bgGradient.addColorStop(1, '#060818');
    _bgH = H;
  }
  ctx.fillStyle = bgGradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 14);
  ctx.fill();

  const now = performance.now();

  bgSquares.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = b.color;
    ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size);
    ctx.restore();
  });
  ctx.globalAlpha = 1;

  /* ── 월드 좌표계 (카메라 스크롤 적용) ── */
  ctx.save();
  ctx.translate(0, -scrollY);

  stages.forEach(stage => {
    if (stage.bot < scrollY - 20 || stage.top > scrollY + H + 20) return;
    ctx.fillStyle = STAGE_TINT[stage.type] || 'rgba(255,255,255,0.03)';
    ctx.fillRect(MARGIN, stage.top, W - MARGIN * 2, stage.bot - stage.top);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, stage.top);
    ctx.lineTo(W - MARGIN, stage.top);
    ctx.stroke();
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.5;
    ctx.fillText(STAGE_ICON[stage.type] || '', W / 2, stage.top + 6);
    ctx.globalAlpha = 1;
  });

  ctx.strokeStyle = 'rgba(150,220,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  funnelWalls.forEach(s => {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  });
  ctx.stroke();

  ctx.strokeStyle = 'rgba(96,165,250,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  midWalls.forEach(s => {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  });
  ctx.stroke();

  ctx.strokeStyle = 'rgba(100,150,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, FIELD_BOT);
  ctx.lineTo(W - MARGIN, FIELD_BOT);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(100,150,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(MARGIN, FUNNEL_OPEN_Y);
  ctx.lineTo(MARGIN, FIELD_BOT);
  ctx.moveTo(W - MARGIN, FUNNEL_OPEN_Y);
  ctx.lineTo(W - MARGIN, FIELD_BOT);
  ctx.stroke();

  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.07;
    p.vx *= 0.97;
    p.life -= p.decay;
    return p.life > 0;
  });
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle =
      p.color +
      Math.round(p.life * 255)
        .toString(16)
        .padStart(2, '0');
    ctx.fill();
  });

  pegs.forEach((p, i) => {
    const isBumper = p.type === 'bumper';
    const isWindmill = p.type === 'windmill-blade';
    const isGate = p.type === 'gate';
    const pegR = p.glowR ?? (isBumper ? Math.round(PEG_R * 2) : PEG_R);
    const hitT = hitPegs.get(i);
    const hitFrac = hitT ? Math.max(0, 1 - (now - hitT) / (isBumper ? 500 : 280)) : 0;
    if (hitFrac <= 0 && hitT) hitPegs.delete(i);

    if (isWindmill) {
      if (p.hub) {
        ctx.beginPath();
        ctx.arc(p.motion.cx, p.motion.cy, pegR * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(251,191,36,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.motion.cx, p.motion.cy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pegR * 3);
      gr.addColorStop(0, hitFrac > 0 ? `rgba(255,255,255,${0.6 * hitFrac})` : 'rgba(251,146,60,0.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR * 3, 0, Math.PI * 2);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR, 0, Math.PI * 2);
      ctx.fillStyle = hitFrac > 0 ? '#fff' : '#fb923c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (isGate) {
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pegR * 2.6);
      gr.addColorStop(0, hitFrac > 0 ? `rgba(255,255,255,${0.6 * hitFrac})` : 'rgba(168,85,247,0.3)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR * 2.6, 0, Math.PI * 2);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.roundRect(-p.halfW, -p.halfH, p.halfW * 2, p.halfH * 2, p.halfH * 0.4);
      ctx.fillStyle = hitFrac > 0 ? '#fff' : '#a855f7';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    } else if (isBumper) {
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pegR * 4);
      gr.addColorStop(0, hitFrac > 0 ? `rgba(255,120,0,${0.75 * hitFrac})` : 'rgba(239,68,68,0.32)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR * 4, 0, Math.PI * 2);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = hitFrac > 0 ? '#fff' : 'rgba(239,68,68,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR, 0, Math.PI * 2);
      ctx.fillStyle = hitFrac > 0 ? '#fde68a' : '#ef4444';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = hitFrac > 0 ? '#fff' : 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.fillStyle = hitFrac > 0 ? '#92400e' : 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${pegR}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', p.x, p.y + 1);
    } else {
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pegR * 3.5);
      gr.addColorStop(0, hitFrac > 0 ? `rgba(255,255,255,${0.55 * hitFrac})` : 'rgba(34,211,238,0.28)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, pegR * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-pegR * 0.72, -pegR * 0.72, pegR * 1.44, pegR * 1.44);
      ctx.fillStyle = hitFrac > 0 ? '#ffffff' : '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = hitFrac > 0 ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  });

  /* 잔상을 모든 공 위에 그리기 전에 먼저 렌더링 – z-order 유지 */
  racers.forEach(r => {
    if (r.y > WORLD_H) return;
    r.trail.forEach((pos, i) => {
      const f = (i + 1) / r.trail.length;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, BALL_R * f, 0, Math.PI * 2);
      ctx.fillStyle =
        r.color +
        Math.round(f * 60)
          .toString(16)
          .padStart(2, '0');
      ctx.fill();
    });
  });
  racers.forEach(r => {
    if (r.y > WORLD_H) return;
    const glow = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, BALL_R * 2.4);
    glow.addColorStop(0, r.color + '88');
    glow.addColorStop(1, r.color + '00');
    ctx.beginPath();
    ctx.arc(r.x, r.y, BALL_R * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    const grad = ctx.createRadialGradient(r.x - BALL_R * 0.3, r.y - BALL_R * 0.3, 0, r.x, r.y, BALL_R);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.45, r.color);
    grad.addColorStop(1, r.color);
    ctx.beginPath();
    ctx.arc(r.x, r.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.restore();
  /* ── 여기부터 화면 좌표계 (스크롤 영향 없음) ── */

  drawLeaderboard();
  if (raceWinner) drawWinnerOverlay(now);
}

function drawLeaderboard() {
  if (!slots.length) return;
  let list;
  if (racers.length) {
    list = racers
      .map(r => ({ label: r.label, color: r.color, y: r.y, finished: r.finished }))
      .sort((a, b) => b.finished - a.finished || b.y - a.y);
  } else {
    list = slots.map(s => ({ label: s.label, color: s.color }));
  }
  const n = list.length;
  const fontSize = Math.max(8, Math.min(11, Math.floor(150 / n)));
  ctx.font = `bold ${fontSize}px 'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  list.forEach((item, i) => {
    const label = (item.label || `참가자${i + 1}`).trim();
    const y = 6 + i * (fontSize + 3);
    ctx.fillStyle = item.color;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 2;
    ctx.fillText(`${label} #${i + 1}`, W - 6, y, W * 0.55);
  });
  ctx.shadowBlur = 0;
}

function drawWinnerOverlay(now) {
  const t = Math.min(1, (now - raceEndT) / 450);
  const scale = 0.7 + 0.3 * easeOut(t);
  ctx.save();
  ctx.globalAlpha = 0.5 * t;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = t;
  ctx.translate(W / 2, H * 0.42);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(14, Math.floor(W * 0.08))}px 'Apple SD Gothic Neo',sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WINNER', 0, -Math.floor(W * 0.09));
  ctx.font = `bold ${Math.max(18, Math.floor(W * 0.12))}px 'Apple SD Gothic Neo',sans-serif`;
  ctx.fillStyle = raceWinner.color;
  ctx.shadowColor = raceWinner.color;
  ctx.shadowBlur = 18;
  ctx.fillText((raceWinner.label || '').trim() || '참가자', 0, Math.floor(W * 0.04));
  ctx.restore();
}

/* ════════════════════════════
   PINBALL: 물리
════════════════════════════ */
function collideSegment(r, seg) {
  const dx = seg.x2 - seg.x1,
    dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((r.x - seg.x1) * dx + (r.y - seg.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = seg.x1 + dx * t,
    py = seg.y1 + dy * t;
  const nx0 = r.x - px,
    ny0 = r.y - py;
  const dist = Math.hypot(nx0, ny0);
  if (dist < BALL_R && dist > 0.001) {
    const nx = nx0 / dist,
      ny = ny0 / dist;
    const dot = r.vx * nx + r.vy * ny;
    if (dot < 0) {
      /* 법선 성분만 반사·감쇠 (접선 속도 유지해야 완만한 경사에서 미끄러져 내려감) */
      const j = -(1 + RESTITUTION) * dot;
      r.vx += j * nx;
      r.vy += j * ny;
    }
    const ov = BALL_R - dist;
    r.x += nx * ov * 1.05;
    r.y += ny * ov * 1.05;
  }
}

function collidePeg(r, p, i) {
  const isBumper = p.type === 'bumper';
  const isWindmill = p.type === 'windmill-blade';

  /* 게이트: AABB 박스 충돌 */
  if (p.type === 'gate') {
    const hw = p.halfW,
      hh = p.halfH;
    const cx = Math.max(p.x - hw, Math.min(p.x + hw, r.x));
    const cy = Math.max(p.y - hh, Math.min(p.y + hh, r.y));
    const ddx = r.x - cx,
      ddy = r.y - cy;
    const dist = Math.hypot(ddx, ddy);
    if (dist < BALL_R && dist > 0.001) {
      const nx = ddx / dist,
        ny = ddy / dist;
      const dot = r.vx * nx + r.vy * ny;
      if (dot < 0) {
        r.vx = (r.vx - 2 * dot * nx) * RESTITUTION;
        r.vy = (r.vy - 2 * dot * ny) * RESTITUTION;
        r.vx += (Math.random() - 0.5) * 1.2;
        r.vy += 0.15;
        const s2 = Math.hypot(r.vx, r.vy);
        if (s2 > MAX_SPEED) {
          r.vx = (r.vx / s2) * MAX_SPEED;
          r.vy = (r.vy / s2) * MAX_SPEED;
        }
        hitPegs.set(i, performance.now());
        spawnParticles(r.x, r.y, nx, ny, false);
      }
      const ov = BALL_R - dist;
      r.x += nx * ov * 1.08;
      r.y += ny * ov * 1.08;
    }
    return;
  }

  const pegR = p.glowR ?? (isBumper ? Math.round(PEG_R * 2) : PEG_R);
  const dx = r.x - p.x,
    dy = r.y - p.y;
  const dist = Math.hypot(dx, dy);
  const minD = BALL_R + pegR;
  if (dist < minD && dist > 0.01) {
    const nx = dx / dist,
      ny = dy / dist;
    const dot = r.vx * nx + r.vy * ny;
    if (dot < 0) {
      /* 일반 페그 반발계수를 0.38로 낮춰 공이 튀어 올라 안착하는 현상 방지 */
      const res = isBumper ? Math.min(RESTITUTION * 1.5, 1.1) : isWindmill ? 1.1 : 0.38;
      r.vx = (r.vx - 2 * dot * nx) * res;
      r.vy = (r.vy - 2 * dot * ny) * res;
      if (isBumper) {
        r.vx += nx * 1.5;
        r.vy += ny * 1.5;
      } else if (isWindmill && p.motion) {
        const angle = p.motion.angle0 + performance.now() * 0.001 * p.motion.speed;
        const sign = Math.sign(p.motion.speed);
        r.vx += -Math.sin(angle) * sign * 1.8;
        r.vy += Math.cos(angle) * sign * 1.8;
      } else {
        r.vx += (Math.random() - 0.5) * 1.2;
        r.vy += 0.15;
      }
      const s2 = Math.hypot(r.vx, r.vy),
        cap = isBumper ? MAX_SPEED * 1.4 : isWindmill ? MAX_SPEED * 1.5 : MAX_SPEED;
      if (s2 > cap) {
        r.vx = (r.vx / s2) * cap;
        r.vy = (r.vy / s2) * cap;
      }
      hitPegs.set(i, performance.now());
      spawnParticles(r.x, r.y, nx, ny, isBumper);
    }
    const ov = minD - dist;
    r.x += nx * ov * 1.08;
    r.y += ny * ov * 1.08;
  }
}

function resolveRacerCollisions() {
  const minD = BALL_R * 1.4;
  for (let i = 0; i < racers.length; i++) {
    const a = racers[i];
    if (a.finished || a.y < FUNNEL_OPEN_Y) continue;
    for (let j = i + 1; j < racers.length; j++) {
      const b = racers[j];
      if (b.finished || b.y < FUNNEL_OPEN_Y) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minD && dist > 0.01) {
        const nx = dx / dist,
          ny = dy / dist;
        const overlap = (minD - dist) / 2;
        /* 수평만 분리 – 수직 분리 시 공 쌓임으로 서로 위로 밀어올려 멈춤 유발 */
        a.x -= nx * overlap;
        b.x += nx * overlap;
        const rel = (b.vx - a.vx) * nx;
        if (rel < 0) {
          a.vx += rel * 0.9 * nx;
          b.vx -= rel * 0.9 * nx;
        }
        a.vy += 0.1;
        b.vy += 0.1;
      }
    }
  }
}

function spawnBgSquare() {
  if (bgSquares.length < 14 && Math.random() < 0.22) {
    bgSquares.push({
      x: MARGIN + Math.random() * (W - MARGIN * 2),
      y: -12,
      size: 4 + Math.random() * 5,
      vy: 1 + Math.random() * 1.8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.12,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.07 + Math.random() * 0.08,
    });
  }
}
function updateBgSquares() {
  bgSquares = bgSquares.filter(b => b.y < H + 20);
  bgSquares.forEach(b => {
    b.y += b.vy;
    b.rot += b.vr;
  });
}

function startIdleLoop() {
  if (idleFrame || mode !== 'pinball' || racing) return;
  idleFrame = requestAnimationFrame(idleTick);
}
function stopIdleLoop() {
  if (idleFrame) {
    cancelAnimationFrame(idleFrame);
    idleFrame = null;
  }
}
function idleTick() {
  if (mode !== 'pinball' || racing) {
    idleFrame = null;
    return;
  }
  spawnBgSquare();
  updateBgSquares();
  drawPinball();
  idleFrame = requestAnimationFrame(idleTick);
}

function startRace() {
  if (racing || !slots.length) return;
  stopIdleLoop();
  racing = true;
  btnAction.disabled = true;
  resultBox.className = 'result-box';
  raceWinner = null;
  particles = [];

  const cx = W / 2;
  racers = slots.map(s => ({
    label: s.label,
    color: s.color,
    x: cx + (Math.random() - 0.5) * funnelNeckHalf * 1.5,
    y: FUNNEL_TOP + 4 + Math.random() * (slots.length * 4),
    vx: (Math.random() - 0.5) * 0.6,
    vy: 0.3 + Math.random() * 0.3,
    finished: false,
    trail: [],
  }));
  scrollY = 0;

  animFrame = requestAnimationFrame(raceStep);
}

function raceStep() {
  const now = performance.now();
  spawnBgSquare();
  updateBgSquares();
  updateDynamicPegs(now);

  let winnerFound = null;
  racers.forEach(r => {
    if (r.finished) return;
    r.vy += GRAVITY;
    r.vx *= FRICTION_X;
    const spd = Math.hypot(r.vx, r.vy);
    if (spd > MAX_SPEED) {
      r.vx = (r.vx / spd) * MAX_SPEED;
      r.vy = (r.vy / spd) * MAX_SPEED;
    }
    r.trail.push({ x: r.x, y: r.y });
    if (r.trail.length > 6) r.trail.shift();
    r.x += r.vx;
    r.y += r.vy;
    if (r.y < BALL_R) {
      r.y = BALL_R;
      r.vy = Math.abs(r.vy) * 0.5;
    }

    if (r.y < FUNNEL_NECK_Y) {
      collideSegment(r, funnelWalls[0]);
      collideSegment(r, funnelWalls[1]);
    } else if (r.y < FUNNEL_OPEN_Y) {
      funnelWalls.forEach(seg => collideSegment(r, seg));
    } else {
      if (r.x - BALL_R < MARGIN) {
        r.x = MARGIN + BALL_R;
        r.vx = Math.abs(r.vx) * RESTITUTION + 0.3;
      }
      if (r.x + BALL_R > W - MARGIN) {
        r.x = W - MARGIN - BALL_R;
        r.vx = -Math.abs(r.vx) * RESTITUTION - 0.3;
      }
      pegs.forEach((p, i) => collidePeg(r, p, i));
      /* 바람개비 날개 선분 충돌 – 교차 감지(터널링 방지) + 근접 감지 */
      pegs.forEach((p, i) => {
        if (p.type !== 'windmill-blade' || !p.motion) return;
        const ax = p.motion.cx,
          ay = p.motion.cy,
          bx = p.x,
          by = p.y;
        const ddx = bx - ax,
          ddy = by - ay;
        const blen = Math.hypot(ddx, ddy) || 1;
        const bnx = -ddy / blen,
          bny = ddx / blen;
        const prev = r.trail.length ? r.trail[r.trail.length - 1] : { x: r.x - r.vx, y: r.y - r.vy };
        const d0 = (prev.x - ax) * bnx + (prev.y - ay) * bny;
        const d1 = (r.x - ax) * bnx + (r.y - ay) * bny;
        let handled = false;
        /* ① 교차 감지: 부호가 바뀌면 날개를 통과한 것 */
        if (d0 * d1 < 0) {
          const tc = d0 / (d0 - d1);
          const hx = prev.x + (r.x - prev.x) * tc,
            hy = prev.y + (r.y - prev.y) * tc;
          const along = ((hx - ax) * ddx + (hy - ay) * ddy) / (blen * blen);
          if (along >= 0.02 && along <= 0.98) {
            const side = d0 > 0 ? 1 : -1;
            const cnx = bnx * side,
              cny = bny * side;
            const dot = r.vx * cnx + r.vy * cny;
            if (dot < 0) {
              r.vx = (r.vx - 2 * dot * cnx) * 1.1;
              r.vy = (r.vy - 2 * dot * cny) * 1.1;
              const ang = p.motion.angle0 + performance.now() * 0.001 * p.motion.speed;
              const sg = Math.sign(p.motion.speed);
              r.vx += -Math.sin(ang) * sg * 1.6 * along;
              r.vy += Math.cos(ang) * sg * 1.6 * along;
              const s2 = Math.hypot(r.vx, r.vy);
              if (s2 > MAX_SPEED * 1.5) {
                r.vx = (r.vx / s2) * MAX_SPEED * 1.5;
                r.vy = (r.vy / s2) * MAX_SPEED * 1.5;
              }
              hitPegs.set(i, performance.now());
              spawnParticles(hx, hy, cnx, cny, false);
            }
            r.x = hx + cnx * (BALL_R + 1);
            r.y = hy + cny * (BALL_R + 1);
            handled = true;
          }
        }
        /* ② 근접 감지: 이미 날개에 가까운 경우 */
        if (!handled) {
          const len2 = blen * blen;
          let t = ((r.x - ax) * ddx + (r.y - ay) * ddy) / len2;
          t = Math.max(0.05, Math.min(0.97, t));
          const px = ax + ddx * t,
            py = ay + ddy * t;
          const nx0 = r.x - px,
            ny0 = r.y - py,
            dist = Math.hypot(nx0, ny0);
          const bladeR = BALL_R + 2;
          if (dist < bladeR && dist > 0.001) {
            const nx = nx0 / dist,
              ny = ny0 / dist,
              dot = r.vx * nx + r.vy * ny;
            if (dot < 0) {
              r.vx = (r.vx - 2 * dot * nx) * 1.1;
              r.vy = (r.vy - 2 * dot * ny) * 1.1;
              const ang = p.motion.angle0 + performance.now() * 0.001 * p.motion.speed;
              const sg = Math.sign(p.motion.speed);
              r.vx += -Math.sin(ang) * sg * 1.6 * t;
              r.vy += Math.cos(ang) * sg * 1.6 * t;
              const s2 = Math.hypot(r.vx, r.vy);
              if (s2 > MAX_SPEED * 1.5) {
                r.vx = (r.vx / s2) * MAX_SPEED * 1.5;
                r.vy = (r.vy / s2) * MAX_SPEED * 1.5;
              }
              hitPegs.set(i, performance.now());
              spawnParticles(r.x, r.y, nx, ny, false);
            }
            r.x += nx * (bladeR - dist) * 1.05;
            r.y += ny * (bladeR - dist) * 1.05;
          }
        }
      });
      midWalls.forEach(seg => collideSegment(r, seg));
    }

    /* 멈춤 방지 ① 하강 속도 낮으면 중력 보정 + 좌우 흔들기 */
    if (r.y > FUNNEL_OPEN_Y && r.vy < 0.8) {
      r.vy += 0.12;
      r.vx += (Math.random() - 0.5) * 0.2;
    }

    /* 멈춤 방지 ② 완전 정지 감지 → 즉시 강제 킥 */
    if (r.y > FUNNEL_OPEN_Y && Math.hypot(r.vx, r.vy) < 0.2) {
      r.vy = 2.0;
      r.vx = (Math.random() - 0.5) * 1.5;
    }

    /* 멈춤 방지 ③ 20프레임마다 진행량 체크 → 페그 위치를 강제 통과 */
    r._stuckTick = (r._stuckTick || 0) + 1;
    if (r._stuckTick % 20 === 1) r._stuckRefY = r.y;
    if (r._stuckTick % 20 === 0 && r.y - r._stuckRefY < 3) {
      r.y += (BALL_R + PEG_R) * 2.5;
      r.vy = 2.0;
      r.vx = (Math.random() - 0.5) * 2.0;
    }

    if (r.y + BALL_R >= FIELD_BOT) {
      r.finished = true;
      r.y = FIELD_BOT - BALL_R;
      if (!winnerFound) winnerFound = r;
    }
  });

  resolveRacerCollisions();

  /* 카메라 스크롤: 선두 공을 따라 부드럽게 이동 */
  const leadY = racers.reduce((m, r) => (r.y > m ? r.y : m), -Infinity);
  const target = Math.max(0, Math.min(WORLD_H - H, leadY - H * 0.42));
  scrollY += (target - scrollY) * 0.09;

  drawPinball();

  if (winnerFound) {
    racing = false;
    btnAction.disabled = false;
    raceWinner = winnerFound;
    raceEndT = performance.now();
    showResult(winnerFound.label, winnerFound.color);
    startIdleLoop();
    return;
  }
  animFrame = requestAnimationFrame(raceStep);
}

/* ════════════════════════════
   결과 표시
════════════════════════════ */
function showResult(label, color) {
  const text = (label || '').trim() || '참가자';
  resultLabel.textContent = '🎉 당첨!';
  resultValue.textContent = text;
  resultValue.style.background = `linear-gradient(135deg, ${color}, #fff)`;
  resultValue.style.webkitBackgroundClip = 'text';
  resultValue.style.backgroundClip = 'text';
  resultBox.className = 'result-box show';
}

/* ════════════════════════════
   저장 / 불러오기
════════════════════════════ */
function saveData() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mode,
      map: currentMap,
      count: slots.length,
      labels: slots.map(s => s.label),
    }),
  );
  showMsg('✔ 적용됐어요!');
}

function loadData() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  /* 구버전 spin-picker 데이터 마이그레이션 */
  raw = localStorage.getItem('spin-picker-data');
  if (raw) {
    try {
      const d = JSON.parse(raw);
      return { mode: 'spin', count: d.count, labels: d.labels };
    } catch {}
  }
  return null;
}

function showMsg(text) {
  saveMsg.textContent = text;
  saveMsg.style.opacity = '1';
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => {
    saveMsg.style.opacity = '0';
  }, 2400);
}

/* ════════════════════════════
   슬롯 관리
════════════════════════════ */
function buildSlots(count, labels = []) {
  slots = Array.from({ length: count }, (_, i) => ({
    label: labels[i] ?? '',
    color: COLORS[i % COLORS.length],
  }));
}

function renderInputs() {
  slotsList.innerHTML = '';
  slots.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'slot-item';
    const dot = document.createElement('div');
    dot.className = 'slot-dot';
    dot.style.background = s.color;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = `항목 ${i + 1}`;
    inp.value = s.label;
    inp.addEventListener('input', () => {
      slots[i].label = inp.value;
      drawBoard();
    });
    item.append(dot, inp);
    slotsList.appendChild(item);
  });
}

/* ════════════════════════════
   이벤트
════════════════════════════ */
btnAction.addEventListener('click', () => {
  if (mode === 'spin') spin();
  else startRace();
});

btnApply.addEventListener('click', () => {
  const max = mode === 'pinball' ? 10 : 20;
  const count = Math.min(max, Math.max(2, parseInt(slotCountInput.value) || 6));
  slotCountInput.value = count;
  buildSlots(
    count,
    slots.map(s => s.label),
  );
  renderInputs();
  resetRaceState();
  if (mode === 'pinball') rebuildPinball(count);
  drawBoard();
});

btnSave.addEventListener('click', saveData);

btnReset.addEventListener('click', () => {
  if (!confirm('모든 항목을 초기화할까요?')) return;
  buildSlots(6);
  slotCountInput.value = 6;
  renderInputs();
  resetRaceState();
  if (mode === 'pinball') rebuildPinball(6);
  drawBoard();
  resultBox.className = 'result-box';
});

function toggleDropdown(e) {
  e.stopPropagation();
  const isOpen = settingsDrop.classList.toggle('open');
  btnSettings.classList.toggle('active', isOpen);
}
function closeDropdown() {
  settingsDrop.classList.remove('open');
  btnSettings.classList.remove('active');
}
btnSettings.addEventListener('click', toggleDropdown);
document.addEventListener('click', e => {
  if (!settingsDrop.contains(e.target) && e.target !== btnSettings) closeDropdown();
});

menuClearCache.addEventListener('click', () => {
  closeDropdown();
  localStorage.removeItem(STORAGE_KEY);
  showMsg('🗑️ 캐시를 비웠어요!');
});

menuReset.addEventListener('click', () => {
  closeDropdown();
  if (!confirm('보드와 저장 데이터를 모두 초기화할까요?')) return;
  localStorage.removeItem(STORAGE_KEY);
  buildSlots(6);
  slotCountInput.value = 6;
  renderInputs();
  resetRaceState();
  if (mode === 'pinball') rebuildPinball(6);
  drawBoard();
  resultBox.className = 'result-box';
  showMsg('↺ 초기화됐어요!');
});

btnLoadPreset.addEventListener('click', () => {
  const key = presetSelect.value;
  if (!key) {
    alert('예제를 먼저 선택해주세요.');
    return;
  }
  const preset = PRESETS[key];
  if (!preset) return;
  const max = mode === 'pinball' ? 10 : 20;
  const count = Math.min(max, preset.items.length);
  buildSlots(count, preset.items);
  slotCountInput.value = count;
  renderInputs();
  resetRaceState();
  if (mode === 'pinball') rebuildPinball(count);
  drawBoard();
  resultBox.className = 'result-box';
  showMsg(`✔ "${preset.title}" 불러왔어요!`);
  presetSelect.value = '';
  if (isMobile()) openSheet();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvas();
    if (!isMobile()) {
      backdrop.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }, 100);
});

/* ════════════════════════════
   초기화
════════════════════════════ */
(function init() {
  const saved = loadData();
  if (saved) {
    mode = saved.mode === 'pinball' ? 'pinball' : 'spin';
    if (saved.map) {
      currentMap = saved.map;
      document.querySelectorAll('.map-btn').forEach(b => b.classList.toggle('active', b.dataset.map === currentMap));
    }
    slotCountInput.value = saved.count;
    buildSlots(saved.count, saved.labels);
  } else {
    buildSlots(6);
  }
  applyModeUI();
  renderInputs();
  resizeCanvas();
  if (mode === 'pinball') startIdleLoop();
})();
