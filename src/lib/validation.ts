export const FIELD_LIMITS: Record<string, {min:number;max:number;optional?:boolean;integer?:boolean}> = {
 kaufpreis:{min:.01,max:1e12},wohnflaeche:{min:.01,max:1e7},zins:{min:0,max:15},tilgung:{min:0,max:15},notarProzent:{min:0,max:10},maklerProzent:{min:0,max:10},vacancyPercent:{min:0,max:100},equityPercentOfPrice:{min:0,max:100},fixedInterestYears:{min:1,max:30,optional:true,integer:true},mietePA:{min:0,max:1e12},mietePM:{min:0,max:1e12},zielMietePA:{min:0,max:1e12},zielMietpreisQm:{min:0,max:1e6},instandhaltungQm:{min:0,max:1e6},verwaltungPm:{min:0,max:1e9},ruecklagePm:{min:0,max:1e9},movableItemsAmount:{min:0,max:1e12},targetCashFlowAnnual:{min:0,max:1e12},targetNetYieldPercent:{min:0,max:100,optional:true}
};
export function validateFields(state:Record<string,unknown>,parse:(v:string)=>number){
 const issues:Record<string,string>={};
 for(const [key,rule] of Object.entries(FIELD_LIMITS)){
  const raw=state[key];if(typeof raw!=='string'||(rule.optional&&raw.trim()===''))continue;
  const value=parse(raw);
  if(!raw.trim()||!/^[+-]?(?:\d+(?:[.,]\d+)*|[.,]\d+)$/.test(raw.replace(/[\s€%]/g,''))||!Number.isFinite(value)||value<rule.min||value>rule.max||(rule.integer&&!Number.isInteger(value)))issues[key]=`Bitte einen ${rule.integer?'ganzzahligen ':''}Wert zwischen ${rule.min.toLocaleString('de-DE')} und ${rule.max.toLocaleString('de-DE')} eingeben.`;
 }
 return issues;
}
