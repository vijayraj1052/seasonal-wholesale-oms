import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Hard block: if any admin already exists, provisioning is permanently closed.
    // This check runs BEFORE the secret check so that even a valid bootstrap secret
    // cannot create another admin once the first one exists.
    const { data: existingAdmins, error: checkError } = await adminClient
      .from("admin_profiles")
      .select("user_id");

    if (checkError) {
      return new Response(
        JSON.stringify({ error: "Failed to check existing admins" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if ((existingAdmins?.length ?? 0) > 0) {
      return new Response(
        JSON.stringify({
          error:
            "Admin provisioning is permanently closed. An admin account already exists.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // No admin exists yet — require the bootstrap secret.
    const bootstrapSecret = Deno.env.get("BOOTSTRAP_ADMIN_SECRET")!;

    if (!bootstrapSecret) {
      return new Response(
        JSON.stringify({ error: "Bootstrap secret not configured on the server" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const email: string | undefined = body.email;
    const password: string | undefined = body.password;
    const fullName: string | undefined = body.full_name;
    const providedSecret: string | undefined = body.bootstrap_secret;

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: "email, password, and full_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!providedSecret || providedSecret !== bootstrapSecret) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing bootstrap secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: authData, error: createError } = await adminClient.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role: "admin" },
      });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "First admin account created successfully. You can now sign in at /admin/login.",
        user_id: authData.user?.id,
        email,
        full_name: fullName,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
