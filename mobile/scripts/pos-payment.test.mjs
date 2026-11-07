import assert from "node:assert/strict";
import {test} from "node:test";
import {isDueCustomer,paymentRequestId,posPaymentMethods} from "../src/utils/posPayment.ts";
test("due requires an identified customer rather than the walk-in placeholder",()=>{
  for(const customer of [null,undefined,{}, {name:"",phone:"01712345678"},{name:"Walk-in",phone:"01712345678"},{name:"Buyer",phone:"00000000000"},{name:"Buyer",phone:"017"}])assert.equal(isDueCustomer(customer),false);
  assert.equal(isDueCustomer({name:"New buyer",phone:"01712345678"}),true);
  assert.equal(isDueCustomer({name:"Existing buyer",phone:"+880 1712 345678"}),true);
  assert.ok(posPaymentMethods.DUE);
});
test("collection retry identifiers are valid UUIDs and distinct",()=>{
  const ids=Array.from({length:30},paymentRequestId);assert.equal(new Set(ids).size,30);
  for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
