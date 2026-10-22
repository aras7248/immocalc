import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const userId='00000000-0000-0000-0000-000000000001';
const user={id:userId,aud:'authenticated',role:'authenticated',email:'ci@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.c2lnbmF0dXJl';
const session={access_token:token,refresh_token:'ci-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(value=>localStorage.setItem('sb-example-auth-token',JSON.stringify(value)),session);
let rows=[];
await page.route('https://example.supabase.co/**',async route=>{
 const req=route.request();const url=new URL(req.url());const method=req.method();
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'*','content-type':'application/json'};
 if(method==='OPTIONS')return route.fulfill({status:200,headers,body:''});
 let data;
 if(url.pathname.endsWith('/user'))data=user;
 else if(url.pathname.includes('immocalc_entitlements'))data=[{user_id:userId,level:'professional',valid_until:null,source:'ci-only'}];
 else if(url.pathname.includes('immocalc_saved_objects')){
  if(method==='POST'){const raw=req.postDataJSON();const row={...raw,id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};rows.push(row);data=[row];}
  else if(method==='PATCH'){const id=url.searchParams.get('id')?.slice(3);const version=url.searchParams.get('updated_at')?.slice(3);const match=rows.find(r=>r.id===id&&r.updated_at===version);if(match){Object.assign(match,req.postDataJSON(),{updated_at:new Date().toISOString()});data=[match];}else data=[];}
  else if(method==='DELETE'){rows=rows.filter(r=>r.id!==url.searchParams.get('id')?.slice(3));data=[];}
  else data=rows.filter(r=>!url.searchParams.has('id')||r.id===url.searchParams.get('id').slice(3));
 }else data={};
 if(req.headers()['accept']?.includes('vnd.pgrst.object'))data=Array.isArray(data)?data[0]??null:data;
 await route.fulfill({status:200,headers,body:JSON.stringify(data)});
});
try{
 await page.goto('http://127.0.0.1:4001');await page.locator('.app-container').waitFor();
 const before=await page.locator('.results-sticky').first().innerText();
 await page.locator('#standard-interest').fill('5');await page.locator('#standard-interest').blur();
 assert.notEqual(await page.locator('.results-sticky').first().innerText(),before);
 await page.getByRole('button',{name:'Immobilie speichern',exact:true}).click();
 await page.locator('.saved-object__load').first().waitFor();assert.equal(rows.length,1);
 await page.locator('#standard-interest').fill('6');await page.locator('#standard-interest').blur();
 await page.locator('.saved-object__load').first().click();assert.equal(await page.locator('#standard-interest').inputValue(),'5,00');
 await page.getByRole('button',{name:'Gespeicherte Objekte schließen'}).click();
 await page.locator('#reverse-tab').click();await page.locator('#reverse-panel').waitFor();
 await page.locator('#premium-tab').click();await page.locator('#premium-panel').waitFor();
 await page.locator('#standard-tab').click();

 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,'Mobile page must not overflow');
 assert.deepEqual(errors,[]);await writeFile('test-results/browser-summary.json',JSON.stringify({checks:['standard input to result','mocked save/load','all mode tabs','desktop/mobile','no page errors'],passed:true},null,2));
}catch(error){await page.screenshot({path:'test-results/failure.png',fullPage:true});throw error;}finally{await browser.close();}
