import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Self-contained so Dashboard deploy works (no ../_shared import).
// Keep in sync with src/services/moderationRules.js

const CAPTION_MAX_LENGTH = 500;
const COMMENT_MAX_LENGTH = 500;
const LOCATION_MAX_LENGTH = 200;

const PROHIBITED_TERMS = [
  "kill yourself",
  "kys",
  "nigger",
  "faggot",
  "child porn",
  "csam",
  "rape you",
];

const SPAM_PATTERNS = [
  /(.)\1{12,}/i,
  /https?:\/\/\S+/gi,
  /\b(buy now|crypto giveaway|free money|onlyfans)\b/i,
];

type ModerationDecision = "approved" | "rejected";

function screenTextWithRules(
  text: string,
): { decision: ModerationDecision; reason?: string } {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return { decision: "approved" };
  }

  for (const term of PROHIBITED_TERMS) {
    if (normalized.includes(term)) {
      return { decision: "rejected", reason: "prohibited_term" };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      return { decision: "rejected", reason: "spam_pattern" };
    }
  }

  return { decision: "approved" };
}

async function screenWithExternalProvider(
  text: string,
  opts: { apiKey?: string; endpoint?: string } | null,
): Promise<{ decision: ModerationDecision; reason?: string }> {
  if (!opts?.apiKey || !opts?.endpoint) {
    return { decision: "approved" };
  }

  try {
    const res = await fetch(opts.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        text: text.slice(0, 2000),
        languages: ["en"],
      }),
    });

    if (!res.ok) {
      return { decision: "approved" };
    }

    const data = await res.json();
    if (data?.flagged === true || data?.decision === "rejected") {
      return { decision: "rejected", reason: "external_provider" };
    }
    return { decision: "approved" };
  } catch {
    return { decision: "approved" };
  }
}

async function screenContent(text: string): Promise<{
  decision: ModerationDecision;
  reason?: string;
}> {
  const local = screenTextWithRules(text);
  if (local.decision === "rejected") return local;

  return screenWithExternalProvider(text, {
    apiKey: Deno.env.get("MODERATION_API_KEY") ?? undefined,
    endpoint: Deno.env.get("MODERATION_API_ENDPOINT") ?? undefined,
  });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GUIDELINES_MESSAGE =
  "This content may violate the Water Warrior Community Guidelines.";

type PublishBody = {
  type?: "post" | "comment";
  front_photo_url?: string;
  back_photo_url?: string;
  caption?: string;
  location?: string;
  bottle_size_ml?: number;
  bottle_id?: string | null;
  post_id?: string;
  content?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, message: "Server misconfigured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, message: "Missing authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ ok: false, message: "Not authenticated" }, 401);
    }

    const body = (await req.json()) as PublishBody;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (body.type === "comment") {
      return await publishComment(admin, user, body);
    }
    if (body.type === "post") {
      return await publishPost(admin, user, body);
    }

    return json({ ok: false, message: "Invalid type" }, 400);
  } catch (err) {
    console.error("publish-social-content error", err?.name || "error");
    return json({ ok: false, message: "Could not publish content" }, 500);
  }
});

async function publishComment(
  admin: ReturnType<typeof createClient>,
  user: { id: string; email?: string },
  body: PublishBody,
) {
  const postId = body.post_id;
  const content = String(body.content ?? "").trim();

  if (!postId) {
    return json({ ok: false, message: "post_id is required" }, 400);
  }
  if (!content) {
    return json({ ok: false, message: "Comment cannot be empty" }, 400);
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    return json(
      { ok: false, message: `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer` },
      400,
    );
  }

  const screening = await screenContent(content);
  if (screening.decision === "rejected") {
    return json(
      { ok: false, code: "CONTENT_REJECTED", message: GUIDELINES_MESSAGE },
      422,
    );
  }

  const { data: post, error: postErr } = await admin
    .from("water_posts")
    .select("id, user_id, moderation_status")
    .eq("id", postId)
    .maybeSingle();

  if (postErr || !post) {
    return json({ ok: false, message: "Post not found" }, 404);
  }

  if (post.moderation_status !== "visible" && post.user_id !== user.id) {
    return json({ ok: false, message: "Cannot comment on this post" }, 403);
  }

  const { data: blocked } = await admin
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${post.user_id}),and(blocker_id.eq.${post.user_id},blocked_id.eq.${user.id})`,
    )
    .limit(1);

  if (blocked && blocked.length > 0) {
    return json({ ok: false, message: "Cannot interact with this user" }, 403);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: inserted, error } = await admin
    .from("water_post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      author_email: profile?.email ?? user.email ?? "",
      content,
      moderation_status: "visible",
    })
    .select("*, profiles(username, full_name, email)")
    .single();

  if (error) {
    console.error("comment insert failed", error.code);
    return json({ ok: false, message: "Could not save comment" }, 500);
  }

  return json({ ok: true, comment: inserted });
}

async function publishPost(
  admin: ReturnType<typeof createClient>,
  user: { id: string; email?: string },
  body: PublishBody,
) {
  const front = String(body.front_photo_url ?? "").trim();
  const back = String(body.back_photo_url ?? "").trim();
  const caption = String(body.caption ?? "").trim();
  const location = String(body.location ?? "").trim();
  const bottleSize = Number(body.bottle_size_ml ?? 500);

  if (!front || !back) {
    return json({ ok: false, message: "Photos are required" }, 400);
  }
  if (caption.length > CAPTION_MAX_LENGTH) {
    return json(
      { ok: false, message: `Caption must be ${CAPTION_MAX_LENGTH} characters or fewer` },
      400,
    );
  }
  if (location.length > LOCATION_MAX_LENGTH) {
    return json(
      { ok: false, message: `Location must be ${LOCATION_MAX_LENGTH} characters or fewer` },
      400,
    );
  }
  if (!Number.isFinite(bottleSize) || bottleSize < 1 || bottleSize > 10000) {
    return json({ ok: false, message: "Invalid bottle size" }, 400);
  }

  const screening = await screenContent(`${caption}\n${location}`);
  if (screening.decision === "rejected") {
    return json(
      { ok: false, code: "CONTENT_REJECTED", message: GUIDELINES_MESSAGE },
      422,
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const row: Record<string, unknown> = {
    user_id: user.id,
    author_email: profile?.email ?? user.email ?? "",
    front_photo_url: front,
    back_photo_url: back,
    caption,
    location,
    bottle_size_ml: Math.round(bottleSize),
    moderation_status: "visible",
  };

  if (body.bottle_id) {
    row.bottle_id = body.bottle_id;
  }

  const { data: inserted, error } = await admin
    .from("water_posts")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("post insert failed", error.code);
    return json({ ok: false, message: "Could not save post" }, 500);
  }

  return json({ ok: true, post: inserted });
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
