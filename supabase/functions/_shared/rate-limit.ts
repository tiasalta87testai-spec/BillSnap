import { getServiceClient } from './supabase.ts';

const LIMITS: Record<string, number> = {
  'upload-image': 20,
  'analyze-receipt': 10,
  'save-receipt': 30,
  'delete-receipt': 10,
  'get-signed-url': 60,
  'get-user-stats': 30,
  'admin-manage-users': 20,
};

export async function checkRateLimit(req: Request, functionName: string): Promise<boolean> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
          || req.headers.get('cf-connecting-ip') 
          || 'unknown';

  const limit = LIMITS[functionName] || 30;
  const supabase = getServiceClient();
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('function_name', functionName)
    .gte('created_at', oneMinuteAgo);

  if ((count || 0) >= limit) {
    return false;
  }

  await supabase
    .from('rate_limits')
    .insert({ ip_address: ip, function_name: functionName });

  return true;
}
