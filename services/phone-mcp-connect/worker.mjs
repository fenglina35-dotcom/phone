import OAuthProvider, { OAuthError, AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { defaultHandler, gmailProxy, refreshGoogle, registrationPolicy, SCOPES, html } from './handlers.mjs';
const ALLOWED_ORIGINS=new Set(['https://fenglina35-dotcom.github.io','http://127.0.0.1:8774','null']);
function provider(env){
 return new OAuthProvider({
  apiRoute:'/mcp',apiHandler:{fetch:gmailProxy},defaultHandler:{fetch:(r,e)=>defaultHandler(r,e)},
  authorizeEndpoint:'/authorize',tokenEndpoint:'/oauth/token',clientRegistrationEndpoint:'/register',
  resourceMetadata:{resource:env.PUBLIC_URL+'/mcp',authorization_servers:[env.PUBLIC_URL]},
  scopesSupported:SCOPES,requiredScopes:['mcp:read'],accessTokenTTL:3300,refreshTokenTTL:30*86400,
  clientIdMetadataDocumentEnabled:true,allowTokenExchangeGrant:false,
  clientRegistrationCallback:args=>registrationPolicy(env,args),
  tokenExchangeCallback:async({grantType,props,env:runtime})=>{
   if(grantType!=='refresh_token')return;
   try{const next=await refreshGoogle(runtime,props);return{newProps:next,accessTokenProps:next,accessTokenTTL:3300};}
   catch(e){throw new OAuthError(e.code==='invalid_grant'?'invalid_grant':'temporarily_unavailable',{description:e.code==='invalid_grant'?'Google authorization is no longer valid.':'Google authorization is temporarily unavailable.',statusCode:e.code==='invalid_grant'?400:503});}
  },
  onError:()=>{}
 });
}
export default {
 async fetch(request,env,context){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(!env.PUBLIC_URL||url.origin!==env.PUBLIC_URL)return new Response('Invalid service origin',{status:400});
  if(origin&&!ALLOWED_ORIGINS.has(origin)&&origin!==url.origin)return new Response('Origin not allowed',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id','Access-Control-Max-Age':'600','Vary':'Origin'}});
  if(url.pathname==='/register'&&(!env.SETUP_KEY||request.headers.get('Authorization')!=='Bearer '+env.SETUP_KEY))return Response.json({error:'access_denied'},{status:403});
  let response;
  try{response=await provider(env).fetch(request,env,context);}
  catch(error){if(error instanceof AuthorizationError||error instanceof CimdFetchError||error.code==='invalid_grant'||error.code==='temporarily_unavailable')response=html('<h1>本次连接未完成</h1><p>请返回小手机重新开始。没有自动重试工具请求。</p>',new Headers(),error.code==='temporarily_unavailable'?503:400);else throw error;}
  const headers=new Headers(response.headers);
  headers.set('Cache-Control',url.pathname==='/client-metadata.json'?'public, max-age=300':'no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
  if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Expose-Headers','Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate');}
  return new Response(response.body,{status:response.status,headers});
 }
};
