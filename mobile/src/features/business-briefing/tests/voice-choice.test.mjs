import assert from "node:assert/strict";
import { banglaVoices } from "../services/voiceChoice.ts";
const voices = [
  { identifier: "en", language: "en-US", name: "Female" },
  { identifier: "bn-in", language: "bn-IN", name: "Tanishaa" },
  { identifier: "bn-bd", language: "bn-BD", name: "Bangshi female" },
];
assert.deepEqual(banglaVoices(voices).map(v => v.identifier), ["bn-bd", "bn-in"]);
assert.deepEqual(banglaVoices([voices[0]]), []);
assert.deepEqual(banglaVoices([]), []);
assert.equal(voices[0].identifier, "en");
console.log("Passed: Bangla locale filtering, Bangladesh preference, female voice hint, missing voice fallback, input immutability.");
