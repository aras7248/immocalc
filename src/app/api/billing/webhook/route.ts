/** Payment integration is deliberately inactive. No request body can grant access. */
export async function POST(){
 return Response.json({enabled:false,error:'Zahlungen sind noch nicht eingerichtet. Es wurde keine Berechtigung geändert.'},{status:501,headers:{'Cache-Control':'no-store'}});
}
