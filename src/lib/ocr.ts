import { parseNumber } from './numberFormat.ts';
export interface OcrFields { kaufpreis?:string;wohnflaeche?:string;mietePM?:string;baujahr?:string }
export function extractOcrFields(text:string):OcrFields{
 const result:OcrFields={};
 const n='([0-9]+(?:[.,][0-9]+)*)';
 const area=text.match(new RegExp('(?:Wohnfläche|Wohnfl[.]?|Wohnflaeche)\\s*[:=]?\\s*(?:ca[.]?\\s*)?'+n,'i'));
 if(area&&parseNumber(area[1])>0)result.wohnflaeche=area[1];
 else if(!/Grundst[üu]ck|Nutzfl[äa]che/i.test(text)){
  const all=[...text.matchAll(new RegExp(n+'\\s*(?:m[²2]|qm)(?![A-Za-z0-9])','gi'))];
  if(all.length===1&&parseNumber(all[0][1])>0)result.wohnflaeche=all[0][1];
 }
 const price=text.match(new RegExp('(?:Kaufpreis|Festpreis)\\s*[:=]?\\s*(?:ca[.]?\\s*)?'+n+'\\s*(?:€|EUR)?','i'));
 if(price&&parseNumber(price[1])>0)result.kaufpreis=price[1];
 const rent=text.match(new RegExp('\\b(?:Kaltmiete|Nettokaltmiete)\\s*(?:monatlich|pro Monat|p[.]?m[.]?)?\\s*[:=]?\\s*'+n+'\\s*(?:€|EUR)','i'));
 if(rent)result.mietePM=rent[1];
 const year=text.match(/\b(?:Baujahr|Bj\.?|Bauj\.?)\s*[:=]?\s*((?:18|19|20)\d{2})\b/i);
 if(year&&Number(year[1])<=new Date().getFullYear())result.baujahr=year[1];
 return result;
}
