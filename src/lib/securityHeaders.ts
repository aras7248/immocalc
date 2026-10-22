export function securityHeaders(url:string|undefined,development=false){
 let origin='https://example.supabase.co';try{origin=new URL(url??origin).origin;}catch{/* Configuration validation reports invalid project URLs separately. */}
 const websocket=origin.replace(/^http/,'ws');
 const report=["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'",`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${development?"'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","font-src 'self'","img-src 'self' data: blob:","worker-src 'self'",`connect-src 'self' ${origin} ${websocket}`].join('; ');
 return [
 {key:'Content-Security-Policy-Report-Only',value:report},
 {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 {key:'X-Frame-Options',value:'DENY'}
 ];
}
