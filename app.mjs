import { market, simulate, benchmark } from './model.mjs';
import { mount, number, money } from './ui.mjs';

mount({
  slug:'battery-dispatch', market, simulate, benchmark,
  strategies:[['rolling','Rolling forecast'],['threshold','Threshold rule'],['oracle','Perfect foresight']],
  highIsGood:true, measure:money, x:{name:'Hour of day',start:0},
  axes:{dispatch:'Energy (MWh)',market:'Price ($/MWh)'},
  config: form => ({regime:form.get('regime'),...Object.fromEntries(
    ['seed','capacity','power','horizon','wear'].map(key => [key,Number(form.get(key))]))}),
  metrics:(selected, all) => [
    ['Net value',money(selected.total)],
    ['Above threshold rule',money(selected.total-all.threshold.total)],
    ['Gap to perfect foresight',money(Math.max(0,all.oracle.total-selected.total))],
  ],
  series:(selected,view) => view==='market'
    ? [{name:'Market price',values:selected.records.map(row=>row.price)}]
    : [{name:'Stored energy',values:selected.records.map(row=>row.after)},{name:'Grid export (+) / import (−)',values:selected.records.map(row=>row.grid)}],
  headings:['Hour','Price $/MWh','Limit %','Start MWh','End MWh','Grid MWh','Net $'],
  table:selected => selected.records.map(row=>[row.hour,number(row.price),number(row.available*100,0),number(row.before,2),number(row.after,2),number(row.grid,2),money(row.net)]),
});
