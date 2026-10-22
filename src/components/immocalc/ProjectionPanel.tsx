'use client';
import { calculateProjection, type ProjectionInput, type ProjectionSettings } from '@/lib/projection';
const money = (n: number) => n.toLocaleString('de-DE', {style:'currency',currency:'EUR'});
export function ProjectionPanel({ input,settings,onChange }: { input: ProjectionInput;settings:ProjectionSettings;onChange:(settings:ProjectionSettings)=>void }) {
 const {years,annualRentGrowthPercent:rentGrowth,annualCostGrowthPercent:costGrowth}=settings;
 const setYears=(years:number)=>onChange({...settings,years});const setRentGrowth=(annualRentGrowthPercent:number)=>onChange({...settings,annualRentGrowthPercent});const setCostGrowth=(annualCostGrowthPercent:number)=>onChange({...settings,annualCostGrowthPercent});
 const result=calculateProjection({...input,annualRentGrowthPercent:rentGrowth,annualCostGrowthPercent:costGrowth},years);
 return <section className="glass-panel" aria-label="Mehrjahresprojektion">
  <h2>Tilgungsplan und Mehrjahresprojektion</h2>
  <div className="calculation-row">
   <label>Zeitraum (Jahre)<input type="number" min="1" max="30" value={years} onChange={e=>setYears(Math.min(30,Math.max(1,Number(e.target.value)||10)))}/></label>
   <label>Mietänderung pro Jahr (%)<input type="number" min="-50" max="100" step="0.1" value={rentGrowth} onChange={e=>setRentGrowth(Number(e.target.value))}/></label>
   <label>Kostenänderung pro Jahr (%)<input type="number" min="-50" max="100" step="0.1" value={costGrowth} onChange={e=>setCostGrowth(Number(e.target.value))}/></label>
  </div>
  <p>Monatliche Annuität, jährliche Zusammenfassung. Mietausfall ist berücksichtigt; alle Werte vor Steuern. Die jährlichen Änderungen sind unabhängig vom einmaligen Szenario.</p>
  {result.fixedInterestYears && <p>Restschuld nach {result.fixedInterestYears} Jahren: {result.remainingDebtAtFixedInterest === null ? 'Zeitraum entsprechend verlängern' : money(result.remainingDebtAtFixedInterest)}</p>}
  {result.extrapolatesBeyondFixedInterest && <p>Nach Ende der Zinsbindung wird derselbe Zinssatz rechnerisch fortgeführt. Eine Anschlussfinanzierung ist damit nicht prognostiziert.</p>}
  <div className="projection-scroll" tabIndex={0} role="region" aria-label="Tilgungsplan horizontal scrollen">
   <table><caption>Jährliche Entwicklung vor Steuern</caption><thead><tr>{['Jahr','Zinsen','Tilgung','Restschuld','Mietertrag','Kosten','Cashflow','Kumuliert'].map(x=><th scope="col" key={x}>{x}</th>)}</tr></thead>
   <tbody>{result.rows.map(r=><tr key={r.year}><th scope="row">{r.year}</th>{[r.interest,r.repayment,r.remainingDebt,r.annualRent,r.operatingCosts,r.cashFlow,r.cumulativeCashFlow].map((v,i)=><td key={i}>{money(v)}</td>)}</tr>)}</tbody></table>
  </div>
 </section>;
}
