import test from 'node:test';import assert from 'node:assert/strict';import {localDayRange,previousLocalDay} from '../kamera/recording-time.mjs';
process.env.TZ='Europe/Warsaw';
test('archive includes all 25 hours and late recordings on October clock-change day',()=>{const [s,e]=localDayRange('2026-10-25');assert.equal((e-s)/3600000,25);assert.ok(+new Date(2026,9,25,23,56)>s&&+new Date(2026,9,25,23,56)<e);assert.equal(new Date(e).getHours(),0);});
test('spring day has 23 hours and previous-day button uses calendar date',()=>{const [s,e]=localDayRange('2026-03-29');assert.equal((e-s)/3600000,23);const d=previousLocalDay(new Date(2026,2,30,0,30));assert.equal(d.getDate(),29);assert.equal(d.getMonth(),2);});
test('invalid archive dates cannot silently roll into another month',()=>{for(const d of ['2026-02-31','2026-99-01','../2026-01-01'])assert.throws(()=>localDayRange(d));});
