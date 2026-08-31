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

function internalEmail(staffId: string) {
  return `pin-${staffId}@blue-ridge.invalid`;
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, value => value.toString(16).padStart(2,'0')).join('');
}

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

    if (pinError) throw pinError;

    const pinRow = Array.isArray(pinRows) ? pinRows[0] : undefined;

    if (!pinRow?.staff_id) {
      return new Response(
        JSON.stringify({ error: 'Incorrect name or 4-digit code.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authUserId = pinRow.auth_user_id as string | undefined | null;
    let email = authUserId ? undefined : internalEmail(pinRow.staff_id);

    if (!authUserId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: pinRow.display_name,
          blue_ridge_role: pinRow.role,
          staff_pin_id: pinRow.staff_id
        }
      });

      if (createError || !created.user) {
        throw createError || new Error('Could not create internal staff identity.');
      }

      authUserId = created.user.id;

      const { error: attachError } = await admin.rpc('attach_staff_auth_identity', {
        p_staff_id: pinRow.staff_id,
        p_auth_user_id: authUserId
      });

      if (attachError) {
        await admin.auth.admin.deleteUser(authUserId);
        throw attachError;
      }
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(authUserId);
    if (userError || !userData.user?.email) {
      throw userError || new Error('Authorized internal identity could not be found.');
    }

    email = userData.user.email;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email
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
