import { describe, expect, test } from 'vitest';
import {
  validateClinicRegistration,
  validateDoctorRegistration,
  validateLogin,
  validatePatientRegistration,
} from './authFormValidation';

describe('auth form validation', () => {
  test('patient registration requires name, gender, phone, and password', () => {
    expect(
      validatePatientRegistration({
        fullName: '',
        gender: null,
        phone: '',
        email: '',
        password: '123',
        confirmPassword: '456',
      }),
    ).toMatchObject({
      fullName: expect.any(String),
      gender: expect.any(String),
      phone: expect.any(String),
      password: expect.any(String),
      confirmPassword: expect.any(String),
    });
  });

  test('doctor registration requires specialty', () => {
    expect(
      validateDoctorRegistration({
        fullName: 'مختص',
        gender: 'male',
        specialtyId: null,
        wilayaId: null,
        phone: '0555123456',
        email: '',
        password: 'Nabdh2026',
        confirmPassword: 'Nabdh2026',
      }),
    ).toMatchObject({
      specialtyId: expect.any(String),
      wilayaId: expect.any(String),
    });
  });

  test('clinic registration requires a valid recovery email', () => {
    expect(
      validateClinicRegistration({
        clinicName: '',
        phone: '',
        email: 'bad email',
        wilayaId: null,
        address: '',
        mapUrl: '',
        password: '123',
        confirmPassword: '456',
      }),
    ).toMatchObject({
      clinicName: expect.any(String),
      phone: expect.any(String),
      email: expect.any(String),
      wilayaId: expect.any(String),
      password: expect.any(String),
      confirmPassword: expect.any(String),
    });

    expect(
      validateClinicRegistration({
        clinicName: 'مركز',
        phone: '0555123456',
        email: '',
        wilayaId: 'wilaya-id',
        address: '',
        mapUrl: '',
        password: 'Nabdh2026',
        confirmPassword: 'Nabdh2026',
      }),
    ).toMatchObject({
      email: expect.any(String),
    });
  });

  test('registration rejects weak passwords before Clerk submit', () => {
    expect(
      validatePatientRegistration({
        fullName: 'عميل',
        gender: 'male',
        phone: '0555123456',
        email: '',
        password: '12345678',
        confirmPassword: '12345678',
      }),
    ).toMatchObject({
      password: expect.stringContaining('ضعيفة'),
    });
  });

  test('login requires phone and password', () => {
    expect(validateLogin({ phone: '', password: '' })).toMatchObject({
      phone: expect.any(String),
      password: expect.any(String),
    });
  });
});
