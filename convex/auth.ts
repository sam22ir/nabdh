import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { normalizeEmailForAuth } from "./lib/authIdentifiers";

async function sendPasswordResetEmail({
  identifier,
  token,
}: {
  identifier: string;
  token: string;
}) {
  const resendApiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM ?? "Nabdh <onboarding@resend.dev>";
  const subject = "رمز إعادة تعيين كلمة مرور نبض";
  const text = [
    "رمز إعادة تعيين كلمة مرور نبض:",
    token,
    "",
    "إذا لم تطلب تغيير كلمة المرور، تجاهل هذه الرسالة.",
  ].join("\n");

  if (!resendApiKey) {
    console.info(
      `[Nabdh password reset] Send code ${token} to ${identifier}. Set AUTH_RESEND_KEY to deliver real email.`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: identifier,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to send password reset email: ${response.status} ${await response.text()}`,
    );
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: normalizeEmailForAuth(String(params.email ?? "")),
        };
      },
      validatePasswordRequirements(password) {
        if (!password || password.length < 6) {
          throw new Error("Invalid password");
        }
      },
      reset: Email({
        async sendVerificationRequest({ identifier, token }) {
          await sendPasswordResetEmail({ identifier, token });
        },
      }),
    }),
  ],
  callbacks: {
    afterUserCreatedOrUpdated: async (ctx, args) => {
      // Only set defaults for first-time signups (not re-auths)
      if (!args.existingUserId && args.profile.email) {
        await ctx.db.patch(args.userId, {
          role: "patient",
          tokenIdentifier: `password:${args.profile.email}`,
        });
      }
    },
  },
});
