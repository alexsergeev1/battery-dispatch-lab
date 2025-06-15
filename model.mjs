export function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const STEP = 0.25;
const CHARGE = 0.94;
const DISCHARGE = 0.94;

export function baseline(hour, regime) {
  const evening = Math.exp(-((hour - 18) ** 2) / 8);
  const noon = Math.exp(-((hour - 12) ** 2) / 12);
  return 44 + (regime === 'scarcity' ? 135 : 75) * evening
    - (regime === 'solar' ? 78 : 36) * noon + 8 * Math.cos((hour - 7) * Math.PI / 12);
}

export function market(seed, regime) {
  const random = rng(seed);
  let deviation = 0;
  return Array.from({ length: 24 }, (_, hour) => {
    deviation = 0.65 * deviation + (random() - 0.5) * (regime === 'scarcity' ? 40 : 24);
    const spike = random() < 0.10 ? (random() - 0.2) * 75 : 0;
    const outage = regime === 'scarcity' && hour >= 17 && hour <= 20 && random() < 0.35;
    return { hour, price: baseline(hour, regime) + deviation + spike, available: outage ? 0.5 : 1 };
  });
}

function meter(delta) {
  return delta > 0 ? -delta * STEP / CHARGE : -delta * STEP * DISCHARGE;
}

function limits(power, available) {
  return [
    Math.floor(power * available / (STEP * DISCHARGE) + 1e-8),
    Math.floor(power * available * CHARGE / STEP + 1e-8),
  ];
}

export function solve(prices, availability, config, terminal) {
  const capacity = Math.round(config.capacity / STEP);
  let future = Float64Array.from({ length: capacity + 1 }, (_, state) => terminal(state));
  const policy = [];
  for (let t = prices.length - 1; t >= 0; t--) {
    const [down, up] = limits(config.power, availability[t]);
    const choices = new Int16Array(capacity + 1);
    const value = new Float64Array(capacity + 1);
    for (let state = 0; state <= capacity; state++) {
      let best = -Infinity;
      for (let next = Math.max(0, state - down); next <= Math.min(capacity, state + up); next++) {
        const delta = next - state;
        const score = meter(delta) * prices[t] - Math.abs(delta) * STEP * config.wear + future[next];
        if (score > best) {
          best = score;
          choices[state] = next;
        }
      }
      value[state] = best;
    }
    policy[t] = choices;
    future = value;
  }
  return { policy, value: future };
}

export function simulate(rows, config, strategy) {
  const cap = Math.round(config.capacity / STEP);
  const start = Math.floor(cap / 2);
  const terminalValue = state => (state - start) * STEP * 40 * DISCHARGE;
  const oracle = strategy === 'oracle'
    ? solve(rows.map(row => row.price), rows.map(row => row.available), config, terminalValue)
    : null;
  let state = start;
  const records = rows.map((row, t) => {
    const [down, up] = limits(config.power, row.available);
    let next = state;
    if (oracle) {
      next = oracle.policy[t][state];
    } else if (strategy === 'rolling') {
      const horizon = rows.slice(t, t + config.horizon);
      const deviation = row.price - baseline(t, config.regime);
      const prices = horizon.map((_, j) => baseline(t + j, config.regime) + deviation * 0.55 ** j);
      const availability = horizon.map((_, j) => j === 0 ? row.available : 1);
      next = solve(prices, availability, config, terminalValue).policy[0][state];
    } else if (row.price < 32) {
      next = Math.min(cap, state + up);
    } else if (row.price > 82) {
      next = Math.max(0, state - down);
    }
    const before = state;
    const delta = next - state;
    const grid = meter(delta);
    state = next;
    return { ...row, before: before * STEP, after: state * STEP, grid,
      net: grid * row.price - Math.abs(delta) * STEP * config.wear };
  });
  const cash = records.reduce((sum, row) => sum + row.net, 0);
  return { records, cash, terminal: terminalValue(state), total: cash + terminalValue(state) };
}

export function benchmark(seed, config, count = 64) {
  return Array.from({ length: count }, (_, index) => {
    const rows = market(seed + index * 7919, config.regime);
    return Object.fromEntries(['rolling', 'threshold', 'oracle']
      .map(strategy => [strategy, simulate(rows, config, strategy).total]));
  });
}
