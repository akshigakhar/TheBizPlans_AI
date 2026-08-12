const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface SupabaseUser { id:string; email?:string; user_metadata?:Record<string,unknown> }
export interface SupabaseSession { access_token:string; refresh_token:string; expires_at?:number; user:SupabaseUser }
export interface BusinessPlanRow { id:string;plan_name:string;business_name:string;stage:string;progress:number;created_at:string;updated_at:string }

const SESSION_KEY='thebizplans.supabase.session';
const configured=Boolean(url&&publishableKey);
let session:SupabaseSession|null=null;
const listeners=new Set<(value:SupabaseSession|null)=>void>();

if(typeof window!=='undefined'){
  try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{localStorage.removeItem(SESSION_KEY)}
}

function requireConfig(){if(!configured)throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');}
function saveSession(value:SupabaseSession|null){session=value;if(typeof window!=='undefined'){value?localStorage.setItem(SESSION_KEY,JSON.stringify(value)):localStorage.removeItem(SESSION_KEY)}for(const listener of listeners)listener(value)}
async function request<T>(path:string,init:RequestInit={},authenticated=false):Promise<T>{
  requireConfig();
  const response=await fetch(`${url}${path}`,{...init,headers:{apikey:publishableKey!,'content-type':'application/json',...(authenticated&&session?{authorization:`Bearer ${session.access_token}`}:{authorization:`Bearer ${publishableKey}`}),...init.headers}});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.msg||body.message||body.error_description||body.error||`Supabase request failed (${response.status})`)}
  return response.status===204?undefined as T:response.json();
}

export const supabase={
  configured,
  auth:{
    getSession:()=>session,
    onAuthStateChange(callback:(value:SupabaseSession|null)=>void){listeners.add(callback);return()=>listeners.delete(callback)},
    async signUp(email:string,password:string,name:string){const value=await request<SupabaseSession>('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{display_name:name}})});if(value.access_token)saveSession(value);return value},
    async signIn(email:string,password:string){const value=await request<SupabaseSession>('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});saveSession(value);return value},
    async signOut(){try{if(session)await request('/auth/v1/logout',{method:'POST'},true)}finally{saveSession(null)}},
    async resetPassword(email:string){return request('/auth/v1/recover',{method:'POST',body:JSON.stringify({email,redirect_to:`${location.origin}/`})})},
    signInWithGoogle(){requireConfig();location.assign(`${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin)}`)},
    consumeRedirect(){if(typeof location==='undefined'||!location.hash)return null;const values=new URLSearchParams(location.hash.slice(1));const access_token=values.get('access_token'),refresh_token=values.get('refresh_token');if(!access_token||!refresh_token)return null;const payload=JSON.parse(atob(access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const value={access_token,refresh_token,expires_at:Number(values.get('expires_at')||0),user:{id:payload.sub,email:payload.email,user_metadata:payload.user_metadata}};history.replaceState(null,'',location.pathname);saveSession(value);return value}
  },
  plans:{
    list(){return request<BusinessPlanRow[]>('/rest/v1/business_plans?select=id,plan_name,business_name,stage,progress,created_at,updated_at&order=updated_at.desc',{},true)},
    create(input:{planName:string;businessName:string}){return request<BusinessPlanRow[]>('/rest/v1/business_plans',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:session?.user.id,plan_name:input.planName,business_name:input.businessName})},true).then(rows=>rows[0])},
    remove(id:string){return request(`/rest/v1/business_plans?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'},true)},
    duplicate(row:BusinessPlanRow){return this.create({planName:`${row.plan_name} (Copy)`,businessName:row.business_name})}
  }
};
