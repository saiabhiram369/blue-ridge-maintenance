import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type Payload = {
  displayName?: string;
  pin?: string;
  portal?: 'admin' | 'technician';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;
    const displayName = body.displayName?.trim() || '';
    const pin = body.pin?.trim() || '';
    const portal = body.portal;

    if (!displayName || !/^\d{4}$/.test(pin) || !portal) {
      return new Response(
        JSON.stringify({ error: 'Enter your name and 4-digit code.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('PIN login service is not configured.');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: pinRows, error: pinError } = await admin.rpc('verify_staff_pin', {
      p_display_name: displayName,
      p_role: portal,
      p_pin: pin
    });

    if (pinError) {
      throw pinError;
    }

    const authUserId = Array.isArray(pinRows) ? pinRows[0]?.auth_user_id : undefined;

    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: 'Incorrect name or 4-digit code.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(authUserId);
    if (userError || !userData.user?.email) {
      throw userError || new Error('Authorized user account could not be found.');
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email
    });

    if (linkError || !linkData.properties?.hashed_token) {
      throw linkError || new Error('Could not create a secure session.');
    }

    return new Response(
      JSON.stringify({
        tokenHash: linkData.properties.hashed_token,
        verificationType: 'magiclink'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PIN login failed.';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
