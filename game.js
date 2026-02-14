const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  time: document.getElementById('time'),
  level: document.getElementById('level'),
  kills: document.getElementById('kills'),
  health: document.getElementById('health'),
  overlay: document.getElementById('overlay'),
  upgradePanel: document.getElementById('upgradePanel'),
  startBtn: document.getElementById('startBtn'),
};

const W = canvas.width;
const H = canvas.height;
const keys = new Set();

const state = {
  running: false,
  paused: false,
  lastTime: 0,
  elapsed: 0,
  kills: 0,
  scoreXP: 0,
  xpToNext: 24,
  level: 1,
  spawnTimer: 0,
  player: null,
  enemies: [],
  projectiles: [],
  drops: [],
  particles: [],
};

const basePlayer = () => ({
  x: W / 2,
  y: H / 2,
  radius: 17,
  speed: 250,
  hp: 100,
  maxHp: 100,
  fireCooldown: 0,
  fireRate: 0.45,
  damage: 18,
  projectileSpeed: 460,
  projectileSize: 7,
  pickupRange: 90,
  hitInvuln: 0,
});

const upgrades = [
  {
    id: 'fury',
    title: 'Blood Fury',
    desc: '+20% attack speed.',
    apply: () => (state.player.fireRate *= 0.8),
  },
  {
    id: 'might',
    title: 'Moonsteel Edge',
    desc: '+8 projectile damage.',
    apply: () => (state.player.damage += 8),
  },
  {
    id: 'swiftness',
    title: 'Nightstride',
    desc: '+12% movement speed.',
    apply: () => (state.player.speed *= 1.12),
  },
  {
    id: 'ward',
    title: 'Crimson Ward',
    desc: '+20 max HP and heal 20.',
    apply: () => {
      state.player.maxHp += 20;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    },
  },
  {
    id: 'magnet',
    title: 'Soul Magnet',
    desc: '+40 pickup range.',
    apply: () => (state.player.pickupRange += 40),
  },
  {
    id: 'bolt',
    title: 'Wider Bolts',
    desc: '+2 projectile size.',
    apply: () => (state.player.projectileSize += 2),
  },
];

function resetGame() {
  state.running = true;
  state.paused = false;
  state.lastTime = 0;
  state.elapsed = 0;
  state.kills = 0;
  state.scoreXP = 0;
  state.xpToNext = 24;
  state.level = 1;
  state.spawnTimer = 0;
  state.player = basePlayer();
  state.enemies = [];
  state.projectiles = [];
  state.drops = [];
  state.particles = [];
  ui.overlay.classList.add('hidden');
  ui.upgradePanel.classList.add('hidden');
  updateHUD();
}

function updateHUD() {
  const sec = Math.floor(state.elapsed);
  ui.time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  ui.level.textContent = state.level;
  ui.kills.textContent = state.kills;
  ui.health.textContent = Math.max(0, Math.ceil(state.player?.hp ?? 0));
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = Math.random() * W;
    y = -30;
  } else if (edge === 1) {
    x = W + 30;
    y = Math.random() * H;
  } else if (edge === 2) {
    x = Math.random() * W;
    y = H + 30;
  } else {
    x = -30;
    y = Math.random() * H;
  }

  const diff = 1 + state.elapsed / 90;
  const typeRoll = Math.random();
  const enemy = {
    x,
    y,
    radius: 13,
    speed: 60 * diff,
    hp: 28 * diff,
    maxHp: 28 * diff,
    damage: 8,
    color: '#6f1844',
  };

  if (typeRoll > 0.82) {
    enemy.radius = 18;
    enemy.speed *= 0.8;
    enemy.hp *= 2.2;
    enemy.maxHp = enemy.hp;
    enemy.damage = 14;
    enemy.color = '#8e275f';
  }

  state.enemies.push(enemy);
}

function nearestEnemy() {
  let target = null;
  let best = Infinity;
  for (const enemy of state.enemies) {
    const d = (enemy.x - state.player.x) ** 2 + (enemy.y - state.player.y) ** 2;
    if (d < best) {
      best = d;
      target = enemy;
    }
  }
  return target;
}

function fireAt(enemy) {
  if (!enemy) return;
  const dx = enemy.x - state.player.x;
  const dy = enemy.y - state.player.y;
  const mag = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    x: state.player.x,
    y: state.player.y,
    vx: (dx / mag) * state.player.projectileSpeed,
    vy: (dy / mag) * state.player.projectileSpeed,
    radius: state.player.projectileSize,
    damage: state.player.damage,
    ttl: 2,
  });
}

function levelUp() {
  state.level += 1;
  state.scoreXP -= state.xpToNext;
  state.xpToNext = Math.floor(state.xpToNext * 1.32);
  state.paused = true;

  const choices = [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);
  ui.upgradePanel.classList.remove('hidden');
  ui.upgradePanel.innerHTML = `
    <h2>Choose your power</h2>
    <div class="upgrade-grid">
      ${choices
        .map(
          (c) => `
        <div class="upgrade-card">
          <h3>${c.title}</h3>
          <p>${c.desc}</p>
          <button data-upgrade="${c.id}">Select</button>
        </div>
      `,
        )
        .join('')}
    </div>
  `;

  ui.upgradePanel.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosen = upgrades.find((u) => u.id === btn.dataset.upgrade);
      chosen?.apply();
      ui.upgradePanel.classList.add('hidden');
      state.paused = false;
      updateHUD();
    });
  });
}

function update(dt) {
  const p = state.player;
  state.elapsed += dt;

  let mx = 0;
  let my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;

  const mag = Math.hypot(mx, my) || 1;
  p.x += (mx / mag) * p.speed * dt;
  p.y += (my / mag) * p.speed * dt;
  p.x = Math.max(20, Math.min(W - 20, p.x));
  p.y = Math.max(20, Math.min(H - 20, p.y));

  p.fireCooldown -= dt;
  if (p.fireCooldown <= 0) {
    fireAt(nearestEnemy());
    p.fireCooldown = p.fireRate;
  }

  const spawnEvery = Math.max(0.18, 0.9 - state.elapsed * 0.008);
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = spawnEvery;
  }

  p.hitInvuln = Math.max(0, p.hitInvuln - dt);

  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const em = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / em) * enemy.speed * dt;
    enemy.y += (dy / em) * enemy.speed * dt;

    const touch = em < p.radius + enemy.radius;
    if (touch && p.hitInvuln <= 0) {
      p.hp -= enemy.damage;
      p.hitInvuln = 0.3;
      for (let i = 0; i < 14; i++) {
        state.particles.push({
          x: p.x,
          y: p.y,
          vx: (Math.random() - 0.5) * 180,
          vy: (Math.random() - 0.5) * 180,
          life: 0.35 + Math.random() * 0.4,
          color: '#ff5b7f',
        });
      }
    }
  }

  for (const shot of state.projectiles) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.ttl -= dt;

    for (const enemy of state.enemies) {
      const d = Math.hypot(shot.x - enemy.x, shot.y - enemy.y);
      if (d < shot.radius + enemy.radius) {
        enemy.hp -= shot.damage;
        shot.ttl = 0;
        if (enemy.hp <= 0) {
          state.kills += 1;
          state.drops.push({ x: enemy.x, y: enemy.y, value: 8, radius: 5 });
          for (let i = 0; i < 10; i++) {
            state.particles.push({
              x: enemy.x,
              y: enemy.y,
              vx: (Math.random() - 0.5) * 140,
              vy: (Math.random() - 0.5) * 140,
              life: 0.25 + Math.random() * 0.35,
              color: '#d8336f',
            });
          }
        }
        break;
      }
    }
  }

  state.enemies = state.enemies.filter((e) => e.hp > 0);
  state.projectiles = state.projectiles.filter(
    (s) => s.ttl > 0 && s.x > -40 && s.y > -40 && s.x < W + 40 && s.y < H + 40,
  );

  for (const orb of state.drops) {
    const dx = p.x - orb.x;
    const dy = p.y - orb.y;
    const d = Math.hypot(dx, dy);
    if (d < p.pickupRange) {
      orb.x += (dx / (d || 1)) * 330 * dt;
      orb.y += (dy / (d || 1)) * 330 * dt;
    }
  }

  state.drops = state.drops.filter((orb) => {
    const got = Math.hypot(orb.x - p.x, orb.y - p.y) < p.radius + 8;
    if (got) {
      state.scoreXP += orb.value;
      return false;
    }
    return true;
  });

  state.particles = state.particles.filter((part) => {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.life -= dt;
    return part.life > 0;
  });

  if (state.scoreXP >= state.xpToNext) {
    levelUp();
  }

  if (p.hp <= 0) {
    state.running = false;
    ui.overlay.classList.remove('hidden');
    ui.overlay.innerHTML = `
      <h2>You were consumed by the swarm</h2>
      <p>Survived ${Math.floor(state.elapsed)}s · Slain ${state.kills}</p>
      <button id="restartBtn">Hunt Again</button>
    `;
    document.getElementById('restartBtn').addEventListener('click', resetGame);
  }

  updateHUD();
}

function draw() {
  const p = state.player;
  ctx.clearRect(0, 0, W, H);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#12091d');
  bgGrad.addColorStop(1, '#04020a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + (i % 5) * 0.01})`;
    ctx.fillRect((i * 241) % W, (i * 137 + state.elapsed * 5) % H, 2, 2);
  }

  for (const orb of state.drops) {
    ctx.beginPath();
    ctx.fillStyle = '#ff4d88';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff4d88';
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const enemy of state.enemies) {
    ctx.beginPath();
    ctx.fillStyle = enemy.color;
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.arc(enemy.x, enemy.y, enemy.radius + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const shot of state.projectiles) {
    ctx.beginPath();
    ctx.fillStyle = '#ff79a8';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#ff79a8';
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const part of state.particles) {
    ctx.fillStyle = part.color;
    ctx.globalAlpha = Math.max(0, part.life * 1.4);
    ctx.fillRect(part.x, part.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.fillStyle = p.hitInvuln > 0 ? '#ffd6e2' : '#f6edf9';
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#ff4f84';
  ctx.lineWidth = 3;
  ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
  ctx.stroke();

  const hpRatio = p.hp / p.maxHp;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(20, H - 28, 280, 14);
  ctx.fillStyle = '#ff3d74';
  ctx.fillRect(20, H - 28, 280 * Math.max(0, hpRatio), 14);

  const xpRatio = state.scoreXP / state.xpToNext;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(20, H - 48, 280, 10);
  ctx.fillStyle = '#8b67ff';
  ctx.fillRect(20, H - 48, 280 * xpRatio, 10);
}

function loop(ts) {
  if (!state.running) return;

  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.033, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  if (!state.paused) {
    update(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

ui.startBtn.addEventListener('click', () => {
  resetGame();
  requestAnimationFrame(loop);
});
