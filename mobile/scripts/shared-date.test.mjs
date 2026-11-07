import assert from "node:assert/strict";
import {test} from "node:test";
import {clampDate,isDateValue,localDateValue} from "../src/components/sharedDate.ts";

test("validates dates and leaves optional empty values empty",()=>{
  assert.equal(isDateValue(""),false);
  assert.equal(isDateValue("2024-02-29"),true);
  for(const value of ["2025-02-29","2026-04-31","2026-13-01","2026-00-01","2026-1-1","not a date"])
    assert.equal(isDateValue(value),false,value);
});
test("clamps days when changing month or leap year",()=>{
  assert.equal(clampDate(2024,2,31,"1900-01-01","2036-12-31"),"2024-02-29");
  assert.equal(clampDate(2025,2,29,"1900-01-01","2036-12-31"),"2025-02-28");
  assert.equal(clampDate(2026,4,31,"1900-01-01","2036-12-31"),"2026-04-30");
});
test("past-only report and payment fields include today but prevent future dates",()=>{
  assert.equal(clampDate(2026,12,31,"1900-01-01","2026-11-06"),"2026-11-06");
  assert.equal(clampDate(2026,11,6,"1900-01-01","2026-11-06"),"2026-11-06");
  assert.equal(clampDate(2025,12,31,"1900-01-01","2026-11-06"),"2025-12-31");
});
test("future dates and start/end constraints are supported",()=>{
  assert.equal(clampDate(2026,10,31,"2026-11-06","2036-12-31"),"2026-11-06");
  assert.equal(clampDate(2027,1,3,"2026-11-06","2036-12-31"),"2027-01-03");
  assert.equal(clampDate(2026,11,5,"2026-11-20","2026-12-10"),"2026-11-20");
  assert.equal(clampDate(2026,12,31,"2026-11-20","2026-12-10"),"2026-12-10");
});
test("date-only conversion keeps the selected local calendar day",()=>{
  assert.equal(localDateValue(new Date(2026,10,6,23,59)),"2026-11-06");
  assert.equal(localDateValue(new Date(2026,10,6,0,0)),"2026-11-06");
});
