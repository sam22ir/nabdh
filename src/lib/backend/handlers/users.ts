import AsyncStorage from '@react-native-async-storage/async-storage';
import { mutation, query, requireUser, unwrap } from '../core';
import { toDoc, wilayaIdToSql } from '../convert';
import { supabase } from '../../supabase';

export const ACTIVE_MODE_KEY = 'nabdh.activeMode';

async function loadMe(userId: string): Promise<any> {
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('profile_private').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  if (!profile) return null;

  let joined: unknown = null;
  let role: string = profile.role;
  let soloClinic: Record<string, unknown> | null = null;
  if (profile.role === 'doctor') {
    const { data } = await supabase.from('doctors').select('*').eq('id', userId).maybeSingle();
    joined = data && { ...data, user_id: userId };
    // A specialist who works alone also owns a personal center ("solo practice").
    const { data: solo } = await supabase
      .from('clinics')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_solo', true)
      .maybeSingle();
    soloClinic = solo;
    const mode = await AsyncStorage.getItem(ACTIVE_MODE_KEY);
    if (solo && mode === 'clinic') {
      // Center view: present the same account as the center it owns.
      role = 'clinic';
      joined = { ...solo, owner_user_id: userId };
    }
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
    role,
    actualRole: profile.role,
    canSwitchRole: Boolean(soloClinic),
    phone: priv?.phone ?? '',
    phoneNormalized: priv?.phone ?? '',
    email: priv?.email ?? undefined,
    termsVersion: priv?.terms_version ?? undefined,
    privacyVersion: priv?.privacy_version ?? undefined,
    legalAcceptedAt: priv?.legal_accepted_at ? Date.parse(priv.legal_accepted_at) : undefined,
    profile: toDoc(joined),
  };
}

const deleteAccount = mutation(async (ctx) => {
  requireUser(ctx);
  unwrap(await ctx.db.rpc('delete_my_account'));
  return { ok: true };
});

export const users = {
  deleteMyPatientAccount: deleteAccount,
  deleteMyDoctorAccount: deleteAccount,
  deleteMyClinicAccount: deleteAccount,

  /** Solo specialists switch between the specialist view and their center view. */
  setActiveMode: mutation(async (ctx, args: { mode: 'doctor' | 'clinic' }) => {
    requireUser(ctx);
    await AsyncStorage.setItem(ACTIVE_MODE_KEY, args.mode);
    return { ok: true };
  }),

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
        latitude: number;
        longitude: number;
        termsVersion: string;
        privacyVersion: string;
        phone?: string;
        address?: string;
        fullName?: string;
      },
    ) => {
      requireUser(ctx);
      return unwrap(
        await ctx.db.rpc('onboard_clinic', {
          p_clinic_name: args.clinicName,
          p_wilaya_id: wilayaIdToSql(args.wilayaId),
          p_latitude: args.latitude,
          p_longitude: args.longitude,
          p_terms_version: args.termsVersion,
          p_privacy_version: args.privacyVersion,
          p_phone: args.phone ?? null,
          p_address: args.address ?? null,
          p_full_name: args.fullName ?? null,
        }),
      );
    },
  ),

  /** Specialist who works alone: creates the personal center they get booked at. */
  createSoloPractice: mutation(
    async (
      ctx,
      args: { latitude: number; longitude: number; name?: string; phone?: string; address?: string },
    ) => {
      requireUser(ctx);
      return unwrap(
        await ctx.db.rpc('create_solo_practice', {
          p_latitude: args.latitude,
          p_longitude: args.longitude,
          p_name: args.name ?? null,
          p_phone: args.phone ?? null,
          p_address: args.address ?? null,
        }),
      );
    },
  ),
};
