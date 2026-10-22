export function requireSupabaseConfig(url:string|undefined,key:string|undefined){
 if(!url?.trim()||!key?.trim())throw new Error('ImmoCalc-Konfiguration fehlt: NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY müssen gesetzt sein. Siehe .env.example.');
 let parsed:URL;try{parsed=new URL(url);}catch{throw new Error('NEXT_PUBLIC_SUPABASE_URL ist keine gültige URL.');}
 if(!['https:','http:'].includes(parsed.protocol))throw new Error('NEXT_PUBLIC_SUPABASE_URL muss HTTP oder HTTPS verwenden.');
 return {url:url.trim(),key:key.trim()};
}
