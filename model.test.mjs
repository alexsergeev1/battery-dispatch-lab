import test from 'node:test';
import assert from 'node:assert/strict';
import { market, solve, simulate, benchmark } from './model.mjs';

const config = { capacity:8, power:2, wear:5, horizon:12, regime:'scarcity' };

test('the solver buys low and sells high with efficiency and wear accounted for', () => {
  const model = solve([10,100], [1,1], { capacity:0.25, power:1, wear:4 }, () => 0);
  assert.equal(model.policy[0][0], 1);
  assert.equal(model.policy[1][1], 0);
  assert.ok(Math.abs(model.value[0] - (100*0.25*0.94-10*0.25/0.94-2)) < 1e-8);
});

test('all strategies respect energy balance and derated meter limits', () => {
  for (let seed=0; seed<30; seed++) {
    const rows = market(seed, config.regime);
    const oracle = simulate(rows, config, 'oracle');
    for (const strategy of ['rolling','threshold','oracle']) {
      const run = simulate(rows, config, strategy);
      assert.ok(run.total <= oracle.total+1e-8);
      assert.ok(Math.abs(run.cash+run.terminal-run.total) < 1e-8);
      let state = config.capacity/2;
      for (const row of run.records) {
        assert.equal(row.before, state);
        assert.ok(row.after >= 0 && row.after <= config.capacity);
        assert.ok(Math.abs(row.grid) <= config.power*row.available+1e-8);
        state = row.after;
      }
    }
  }
});

test('rolling decisions do not see later realized prices or availability', () => {
  const rows = market(77, config.regime);
  const changed = rows.map((row,i) => i<8 ? row : {...row,price:1000,available:0});
  assert.deepEqual(simulate(rows,config,'rolling').records.slice(0,8),
    simulate(changed,config,'rolling').records.slice(0,8));
  assert.deepEqual(benchmark(42,config,4),benchmark(42,config,4));
});
