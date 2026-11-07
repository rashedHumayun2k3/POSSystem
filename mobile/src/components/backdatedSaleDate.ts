import {clampDate,dateParts} from "./sharedDate";
export const firstSaleYear=2000;
export const saleDateParts=dateParts;
export function clampSaleDate(year:number,month:number,day:number,maximum:string){
  return clampDate(year,month,day,`${firstSaleYear}-01-01`,maximum);
}
