import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? 'MISSING';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'MISSING';
  const hasUrl = url !== 'MISSING';
  const hasKey = key !== 'MISSING';

  let dbTest = 'not-attempted';
  let dbError = null;

  if (hasUrl && hasKey) {
    try {
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await supabase.from('rate_limits').select('id').limit(1);
      dbTest = error ? 'error' : 'ok';
      dbError = error ? error.message : null;
    } catch (e: unknown) {
      dbTest = 'exception';
      dbError = (e as Error).message;
    }
  }

  return new Response(
    JSON.stringify({
      SUPABASE_URL: hasUrl ? url : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: hasKey ? `${key.substring(0, 20)}...` : 'MISSING',
      db_select_test: dbTest,
      db_error: dbError,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
});
