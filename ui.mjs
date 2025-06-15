const number = (value, digits = 1) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const money = value => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(value);
const byId = id => document.getElementById(id);
const colors = ['var(--accent)', 'var(--second)'];
const escapeCsv = value => '"' + String(value).replaceAll('"','""') + '"';

function plot(svg, series, xLabel, yLabel) {
  const width = 820;
  const height = 245;
  const left = 57;
  const right = width - 22;
  const top = 17;
  const bottom = height - 43;
  const values = series.flatMap(line => line.values);
  const low = Math.min(0, ...values);
  const high = Math.max(low + 1, ...values);
  const span = high - low;
  const x = index => left + index * (right - left) / Math.max(1, series[0].values.length - 1);
  const y = value => bottom - (value - low) * (bottom - top) / span;
  const grid = Array.from({ length: 5 }, (_, i) => {
    const value = low + i * span / 4;
    const line = y(value);
    return '<line x1="'+left+'" x2="'+right+'" y1="'+line+'" y2="'+line+'"/><text x="'+(left-8)+'" y="'+(line+3)+'" text-anchor="end">'+number(value,0)+'</text>';
  }).join('');
  const end = series[0].values.length - 1;
  const ticks = [...new Set([0, Math.floor(end/4), Math.floor(end/2), Math.floor(end*3/4), end])];
  const labels = ticks.map(i => '<text x="'+x(i)+'" y="'+(bottom+15)+'" text-anchor="middle">'+(i+xLabel.start)+'</text>').join('');
  const traces = series.map((line,i) => '<polyline stroke="'+colors[i]+'" points="'+line.values.map((value,j) => x(j)+','+y(value)).join(' ')+'"/>').join('');
  svg.innerHTML = grid + labels + traces + '<text x="'+left+'" y="11">'+yLabel+'</text><text x="'+right+'" y="'+(height-6)+'" text-anchor="end">'+xLabel.name+'</text>';
}

function setTable(target, headings, rows) {
  const table = byId(target);
  table.tHead.replaceChildren();
  const header = table.tHead.insertRow();
  for (const value of headings) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = value;
    header.append(cell);
  }
  const body = table.tBodies[0];
  body.replaceChildren();
  for (const row of rows) {
    const element = body.insertRow();
    for (const value of row) element.insertCell().textContent = value;
  }
}

function quantile(sorted, fraction) {
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

export function mount(spec) {
  let result;
  let config;
  let batch;
  const form = byId('controls');
  const strategy = byId('strategy');
  const chart = byId('chart');
  strategy.replaceChildren(...spec.strategies.map(([value,label]) => new Option(label,value)));
  function draw() {
    const key = strategy.value;
    const selected = result[key];
    const metrics = spec.metrics(selected, result, config);
    metrics.forEach(([label,value],i) => {
      byId('label'+i).textContent = label;
      byId('value'+i).textContent = value;
    });
    const series = spec.series(selected, chart.value, config);
    plot(byId('plot'), series, spec.x, spec.axes[chart.value]);
    byId('legend').replaceChildren(...series.map((line,i) => {
      const item = document.createElement('span');
      const marker = document.createElement('b');
      marker.style.background = colors[i];
      item.append(marker,line.name);
      return item;
    }));
    setTable('decisions', spec.headings, spec.table(selected));
  }
  function run() {
    config = spec.config(new FormData(form));
    const rows = spec.market(config.seed, config.regime);
    result = Object.fromEntries(spec.strategies.map(([key]) => [key,spec.simulate(rows,config,key)]));
    batch = null;
    byId('benchPanel').hidden = true;
    draw();
    byId('status').textContent = 'Scenario updated.';
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    run();
  });
  strategy.addEventListener('change',draw);
  chart.addEventListener('change',draw);
  byId('benchmark').addEventListener('click', () => {
    const selectedConfig = config;
    byId('status').textContent = 'Running 64 paired scenarios…';
    setTimeout(() => {
      if (config !== selectedConfig) return;
      batch = spec.benchmark(config.seed, config);
      const baseline = spec.strategies[1][0];
      const stats = spec.strategies.map(([key,label]) => {
        const sorted = batch.map(row => row[key]).sort((a,b) => a-b);
        const tail = spec.highIsGood ? sorted.slice(0,7) : sorted.slice(-7);
        const wins = batch.filter(row => spec.highIsGood ? row[key]>row[baseline] : row[key]<row[baseline]).length;
        const average = values => values.reduce((sum,value) => sum + value,0) / values.length;
        return [label,spec.measure(average(sorted)),spec.measure(quantile(sorted,.5)),
          spec.measure(average(tail)), key === baseline ? '—' : number(wins*100/batch.length,0)+'%'];
      });
      setTable('bench', ['Strategy','Mean','Median','Worst 7 mean','Beat baseline'],stats);
      byId('benchPanel').hidden = false;
      byId('status').textContent = 'Benchmark complete.';
    },0);
  });
  function download(rows, name) {
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(escapeCsv).join(',')).join('\n')], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  byId('export').addEventListener('click', () => {
    const selected = result[strategy.value];
    const keys = Object.keys(selected.records[0]);
    download([keys,...selected.records.map(row => keys.map(key => row[key]))],spec.slug+'-decisions.csv');
  });
  byId('exportBench').addEventListener('click', () => {
    if (!batch) return;
    const keys = spec.strategies.map(([key]) => key);
    download([['seed',...keys],...batch.map((row,i) => [config.seed+i*7919,...keys.map(key => row[key])])],spec.slug+'-benchmark.csv');
  });
  run();
}

export { number, money };
