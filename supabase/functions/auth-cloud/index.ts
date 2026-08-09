import { getServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const code = url.searchParams.get('code');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const redirectUri = `${supabaseUrl}/functions/v1/auth-cloud`;
  const frontendAdminUrl = (Deno.env.get('FRONTEND_URL') || 'http://localhost:3000') + '/admin';

  // 1. Avvio flusso OAuth Google con scope per consultazione cartelle e creazione file
  if (action === 'authorize') {
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: true, message: 'GOOGLE_CLIENT_ID non configurato nei secret Supabase' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    // Scope completo per vedere le cartelle esistenti e caricare file
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return Response.redirect(authUrl.toString(), 302);
  }

  // 2. Callback OAuth da Google
  if (code) {
    if (!clientId || !clientSecret) {
      return Response.redirect(`${frontendAdminUrl}?error=missing_credentials`, 302);
    }

    try {
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResp.json();

      if (tokenData.error) {
        console.error('Google token exchange error:', tokenData);
        return Response.redirect(`${frontendAdminUrl}?error=token_exchange_failed`, 302);
      }

      const supabase = getServiceClient();

      const { data: existing } = await supabase
        .from('cloud_settings')
        .select('id, credentials')
        .limit(1)
        .maybeSingle();

      const existingCredentials = existing?.credentials || {};

      const credentials = {
        ...existingCredentials,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || existingCredentials.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        token_type: tokenData.token_type || existingCredentials.token_type,
        scope: tokenData.scope || existingCredentials.scope,
      };

      if (existing) {
        await supabase
          .from('cloud_settings')
          .update({
            provider: 'drive',
            credentials,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cloud_settings')
          .insert({
            provider: 'drive',
            credentials,
            backup_path: '/BillSnap/Receipts',
            is_active: true,
          });
      }

      return Response.redirect(`${frontendAdminUrl}?status=drive_connected`, 302);
    } catch (err) {
      console.error('auth-cloud callback error:', err);
      return Response.redirect(`${frontendAdminUrl}?error=internal_error`, 302);
    }
  }

  return new Response(
    JSON.stringify({ message: 'BillSnap Cloud Auth Edge Function', redirect_uri: redirectUri }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
