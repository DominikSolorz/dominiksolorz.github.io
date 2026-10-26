import {contactHandler} from './core.mjs';
Deno.serve(contactHandler({getConfig:()=>({url:Deno.env.get('CONTACT_RELAY_URL'),secret:Deno.env.get('CONTACT_RELAY_SECRET'),authUrl:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY')})}));
