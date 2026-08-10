import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wrtnltpzmjwwgchapkui.supabase.co";
const supabasePublishableKey = "sb_publishable_hYp_Dz-JLJ8E8vK4Z1r2dg_BUJ7fmv2";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
