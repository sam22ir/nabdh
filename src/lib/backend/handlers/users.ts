import { mutation, query, requireUser, unwrap } from '../core';
import { toDoc, wilayaIdToSql } from '../convert';
import { supabase } from '../../supabase';

async function loadMe(userId: string) {
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('profile_private').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  if (!profile) return null;

  let joined: unknown = null;
  if (profile.role === 'doctor') {
    const { data } = await supabase.from('doctors').select('*').eq('id', userId).maybeSingle();
    joined = data && { ...data, user_id: userId };
  } else if (profile.role === 'clinic') {
    const { data } = await supabase
      .from('clinics')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    joined = data && { ...data, owner_user_id: userId };
  } else {
    joined = { id: userId, user_id: userId };
  }

  return {
    ...toDoc<Record<string, unknown>>(profile),
    phone: priv?.phone ?? '',
    phoneNormalized: priv?.phone ?? '',
    email: priv?.email ?? undefined,
    termsVersion: priv?.terms_version ?? undefined,
    privacyVersion: priv?.privacy_version ?? undefined,
    legalAcceptedAt: priv?.legal_accepted_at ? Date.parse(priv.legal_accepted_at) : undefined,
    profile: toDoc(joined),
  };
}

export const users = {
  /** Signed-in account with its role profile, or null if not onboarded yet. */
  me: query(async (ctx) => (ctx.userId ? await loadMe(ctx.userId) : null)),

  onboardPatient: mutation(
    async (
      ctx,
      args: { termsVersion: string; privacyVersion: string; fullName?: string; phone?: string },
    ) => {
      requireUser(ctx);
      return unwrap(
        await ctx.db.rpc('onboard_patient', {
          p_terms_version: args.termsVersion,
          p_privacy_version: args.privacyVersion,
          p_full_name: args.fullName ?? null,
          p_phone: args.phone ?? null,
        }),
      );
    },
  ),

  onboardDoctor: mutation(
    async (
      ctx,
      args: {
        specialtyId: string;
        wilayaId: string | number;
        termsVersion: string;
        privacyVersion: string;
        fullName?: string;
        phone?: string;
      },
    ) => {
      requireUser(ctx);
      return unwrap(
        await ctx.db.rpc('onboard_doctor', {
          p_specialty_id: args.specialtyId,
          p_wilaya_id: wilayaIdToSql(args.wilayaId),
          p_terms_version: args.termsVersion,
          p_privacy_version: args.privacyVersion,
          p_full_name: args.fullName ?? null,
          p_phone: args.phone ?? null,
        }),
      );
    },
  ),

  onboardClinic: mutation(
    async (
      ctx,
      args: {
        clinicName: string;
        wilayaId: string | number;
        phone: string;
        termsVersion: string;
        privacyVersion: string;
        fullName?: string;
      },
    ) => {
      requireUser(ctx);
      return unwrap(
        await ctx.db.rpc('onboard_clinic', {
          p_clinic_name: args.clinicName,
          p_wilaya_id: wilayaIdToSql(args.wilayaId),
          p_phone: args.phone,
          p_terms_version: args.termsVersion,
          p_privacy_version: args.privacyVersion,
          p_full_name: args.fullName ?? null,
        }),
      );
    },
  ),
};
