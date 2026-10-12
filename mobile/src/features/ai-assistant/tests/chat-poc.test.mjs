import assert from 'node:assert/strict';
import { chatQuestions, getPocAnswer } from '../services/chatPoc.ts';

assert.equal(chatQuestions.length, 10);
for (const item of chatQuestions) {
  for (const question of [item.question, item.roman, ...item.aliases]) {
    assert.equal(getPocAnswer(question), item.answer, question);
  }
}
assert.equal(getPocAnswer('  AJER   SALE KOTO TAKA??? '), 'আজকের সেল ২০০০ টাকা।');
assert.equal(getPocAnswer('আজকের বিক্রি কত টাকা?'), 'আজকের সেল ২০০০ টাকা।');
assert.equal(getPocAnswer('গতকালের সেল কত টাকা?'), 'গতকালের সেল ১৮০০ টাকা।');
assert.match(getPocAnswer('অজানা প্রশ্ন'), /নমুনা উত্তর নেই/);
assert.match(getPocAnswer(''), /নমুনা উত্তর নেই/);
assert.match(getPocAnswer('আজকের সেল কত টাকা এবং খরচ কত টাকা'), /নমুনা উত্তর নেই/);
console.log('Passed: all 10 fixed answers, aliases, normalization, and unknown questions.');
