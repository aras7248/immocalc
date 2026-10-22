"use client";
import type {KeyboardEvent} from 'react';
import {normalizeEquityPercent,normalizeFixedInterestYears} from '@/lib/calculations';
import {parseNumber,formatAcc} from '@/lib/numberFormat';
import type {CalcState} from '@/domain/immocalc/state';
type Field='equityPercentOfPrice'|'fixedInterestYears'|'zins'|'tilgung';
interface Props{state:Pick<CalcState,Field>;prefix:string;issues:Record<string,string>;onChange:(field:Field,value:string)=>void;onBlur?:(field:Field)=>void;onEnter:(event:KeyboardEvent<HTMLInputElement>)=>void}
export function EquityFields({state,prefix,issues,onChange,onEnter}:Props){return (<div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor={`${prefix}-equity-percent`}>Eigenkapital im Kaufpreis</label>
                    <div className="input-wrapper">
                      <input id={`${prefix}-equity-percent`} type="text" inputMode="decimal" value={state.equityPercentOfPrice} onChange={(e) => onChange("equityPercentOfPrice", e.target.value)} onBlur={() => onChange("equityPercentOfPrice", formatAcc(normalizeEquityPercent(parseNumber(state.equityPercentOfPrice))))} onKeyDown={onEnter} aria-describedby={`${prefix}-equity-help`} aria-invalid={parseNumber(state.equityPercentOfPrice) < 0 || parseNumber(state.equityPercentOfPrice) > 100} />
{issues.equityPercentOfPrice && <small role="alert" className="validation-message">{issues.equityPercentOfPrice}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                    <small id={`${prefix}-equity-help`}>0 bis 100 % des Kaufpreises, zusätzlich zu den vollständig aus Eigenkapital bezahlten Kaufnebenkosten.</small>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor={`${prefix}-fixed-interest-years`}>Zinsbindung (optional)</label>
                    <div className="input-wrapper">
                      <input id={`${prefix}-fixed-interest-years`} type="text" inputMode="numeric" value={state.fixedInterestYears} onChange={(e) => onChange("fixedInterestYears", e.target.value)} onBlur={() => onChange("fixedInterestYears", String(normalizeFixedInterestYears(parseNumber(state.fixedInterestYears)) ?? ""))} onKeyDown={onEnter} aria-describedby={`${prefix}-fixed-interest-help`}  aria-invalid={Boolean(issues.fixedInterestYears)} />
{issues.fixedInterestYears && <small role="alert" className="validation-message">{issues.fixedInterestYears}</small>}
                      <span className="input-suffix">Jahre</span>
                    </div>
                    <small id={`${prefix}-fixed-interest-help`}>1 bis 30 volle Jahre. Die Zinsbindung wird gespeichert; die angezeigten Kennzahlen beziehen sich auf das erste Jahr.</small>
                  </div>
                </div>);}
export function DebtRateFields({state,prefix,issues,onChange,onBlur,onEnter}:Props){return (<div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor={`${prefix}-interest`}>Zins</label>
                    <div className="input-wrapper">
                      <input id={`${prefix}-interest`} inputMode="decimal" type="text" value={state.zins} onChange={(e) => onChange("zins", e.target.value)} onBlur={() => onBlur?.("zins")} onKeyDown={onEnter}  aria-invalid={Boolean(issues.zins)} />
{issues.zins && <small role="alert" className="validation-message">{issues.zins}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor={`${prefix}-repayment`}>Tilgung</label>
                    <div className="input-wrapper">
                      <input id={`${prefix}-repayment`} inputMode="decimal" type="text" value={state.tilgung} onChange={(e) => onChange("tilgung", e.target.value)} onBlur={() => onBlur?.("tilgung")} onKeyDown={onEnter}  aria-invalid={Boolean(issues.tilgung)} />
{issues.tilgung && <small role="alert" className="validation-message">{issues.tilgung}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                </div>);}
