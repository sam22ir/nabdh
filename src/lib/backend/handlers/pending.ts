// Convex functions that screens still call and that are not ported to Supabase yet.
// Each one throws until implemented; port them module by module and delete the entry here.
import { BackendError, mutation, query } from '../core';

const todo = (name: string) => async (): Promise<any> => {
  throw new BackendError(`Not implemented yet: ${name}`);
};

export const pending = {
  clinicMemberships: {
    accept: mutation<any, any>(todo('clinicMemberships.accept')),
    cancel: mutation<any, any>(todo('clinicMemberships.cancel')),
    getMyAcceptedClinic: query<any, any>(todo('clinicMemberships.getMyAcceptedClinic')),
    inviteDoctor: mutation<any, any>(todo('clinicMemberships.inviteDoctor')),
    leaveClinic: mutation<any, any>(todo('clinicMemberships.leaveClinic')),
    listMyClinicDoctors: query<any, any>(todo('clinicMemberships.listMyClinicDoctors')),
    listMyClinicInvites: query<any, any>(todo('clinicMemberships.listMyClinicInvites')),
    listMyClinicRequests: query<any, any>(todo('clinicMemberships.listMyClinicRequests')),
    listMyDoctorInvites: query<any, any>(todo('clinicMemberships.listMyDoctorInvites')),
    listMyDoctorRequests: query<any, any>(todo('clinicMemberships.listMyDoctorRequests')),
    reject: mutation<any, any>(todo('clinicMemberships.reject')),
    removeDoctor: mutation<any, any>(todo('clinicMemberships.removeDoctor')),
    requestToJoinClinic: mutation<any, any>(todo('clinicMemberships.requestToJoinClinic')),
  },
  clinicSettings: {
    getMy: query<any, any>(todo('clinicSettings.getMy')),
    updateMy: mutation<any, any>(todo('clinicSettings.updateMy')),
  },
  clinics: {
    getBookingContext: query<any, any>(todo('clinics.getBookingContext')),
    getById: query<any, any>(todo('clinics.getById')),
    listPublic: query<any, any>(todo('clinics.listPublic')),
  },
  doctors: {
    getById: query<any, any>(todo('doctors.getById')),
    getFavorites: query<any, any>(todo('doctors.getFavorites')),
    getMyProfile: query<any, any>(todo('doctors.getMyProfile')),
    isFavorite: query<any, any>(todo('doctors.isFavorite')),
    listPublic: query<any, any>(todo('doctors.listPublic')),
    search: query<any, any>(todo('doctors.search')),
    toggleFavorite: mutation<any, any>(todo('doctors.toggleFavorite')),
    updateProfile: mutation<any, any>(todo('doctors.updateProfile')),
  },
  encounterNotes: {
    add: mutation<any, any>(todo('encounterNotes.add')),
    listForBooking: query<any, any>(todo('encounterNotes.listForBooking')),
  },
  module: {
    fn: query<any, any>(todo('module.fn')),
  },
  notifications: {
    registerPushToken: mutation<any, any>(todo('notifications.registerPushToken')),
    unregisterPushToken: mutation<any, any>(todo('notifications.unregisterPushToken')),
  },
  patientProfiles: {
    create: mutation<any, any>(todo('patientProfiles.create')),
    listMy: query<any, any>(todo('patientProfiles.listMy')),
  },
  reviews: {
    create: mutation<any, any>(todo('reviews.create')),
    getMyPending: query<any, any>(todo('reviews.getMyPending')),
    getStats: query<any, any>(todo('reviews.getStats')),
    listByDoctor: query<any, any>(todo('reviews.listByDoctor')),
  },
  schedules: {
    addClinicException: mutation<any, any>(todo('schedules.addClinicException')),
    getByClinic: query<any, any>(todo('schedules.getByClinic')),
    getByDoctor: query<any, any>(todo('schedules.getByDoctor')),
    getMyClinicExceptions: query<any, any>(todo('schedules.getMyClinicExceptions')),
    removeException: mutation<any, any>(todo('schedules.removeException')),
    upsertDay: mutation<any, any>(todo('schedules.upsertDay')),
  },
  users: {
    completeDoctorProfile: mutation<any, any>(todo('users.completeDoctorProfile')),
    completePatientProfile: mutation<any, any>(todo('users.completePatientProfile')),
    deleteMyClinicAccount: mutation<any, any>(todo('users.deleteMyClinicAccount')),
    deleteMyDoctorAccount: mutation<any, any>(todo('users.deleteMyDoctorAccount')),
    deleteMyPatientAccount: mutation<any, any>(todo('users.deleteMyPatientAccount')),
    findAccountByIdentifier: query<any, any>(todo('users.findAccountByIdentifier')),
    updateMyClinicProfile: mutation<any, any>(todo('users.updateMyClinicProfile')),
    updateProfile: mutation<any, any>(todo('users.updateProfile')),
  },
};
