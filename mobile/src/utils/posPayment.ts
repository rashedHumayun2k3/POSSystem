export const posPaymentMethods={CASH:"Cash",CARD:"Card",BKASH:"bKash",NAGAD:"Nagad",DUE:"DUE"} as const;
export type PosPaymentMethod=keyof typeof posPaymentMethods;
export function isDueCustomer(customer:{name?:string;phone?:string}|null|undefined):boolean{
  const name=customer?.name?.trim()??"",digits=(customer?.phone??"").replace(/\D/g,"");
  return !!name&&name.toLowerCase()!=="walk-in"&&digits.length>=7&&digits.length<=15&&/[1-9]/.test(digits);
}
// Used only as an idempotency identifier, never as a credential or security token.
export function paymentRequestId():string{
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return (c==="x"?n:(n&3)|8).toString(16)});
}
