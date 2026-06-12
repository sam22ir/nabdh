import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: Email({
        async sendVerificationRequest({ identifier, token }) {
          console.info(
            `[Nabdh password reset] Send code ${token} to ${identifier}`,
          );
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
