import { describe, expect, test } from 'vitest';

import {
  formatClinicMapInput,
  getClinicMapUrl,
  parseClinicMapInput,
} from './clinicMapLink';

describe('clinic map links', () => {
  test('parses raw latitude and longitude coordinates', () => {
    expect(parseClinicMapInput('36.7525, 3.0419')).toEqual({
      latitude: 36.7525,
      longitude: 3.0419,
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=36.7525,3.0419',
    });
  });

  test('parses coordinates from a full Google Maps URL', () => {
    const parsed = parseClinicMapInput(
      'https://www.google.com/maps/place/Clinic/@36.7525,3.0419,17z/data=!3m1!4b1',
    );

    expect(parsed).toEqual({
      latitude: 36.7525,
      longitude: 3.0419,
      mapUrl:
        'https://www.google.com/maps/place/Clinic/@36.7525,3.0419,17z/data=!3m1!4b1',
    });
  });

  test('parses coordinates from Google Maps query parameters', () => {
    const parsed = parseClinicMapInput(
      'https://www.google.com/maps/search/?api=1&query=36.7525%2C3.0419',
    );

    expect(parsed).toEqual({
      latitude: 36.7525,
      longitude: 3.0419,
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=36.7525%2C3.0419',
    });
  });

  test('accepts a short Google Maps share link even when coordinates are hidden', () => {
    expect(parseClinicMapInput('https://maps.app.goo.gl/abc123')).toEqual({
      mapUrl: 'https://maps.app.goo.gl/abc123',
    });
  });

  test('rejects non Google Maps links and impossible coordinates', () => {
    expect(parseClinicMapInput('https://example.com/clinic')).toBeNull();
    expect(parseClinicMapInput('120, 3.0419')).toBeNull();
  });

  test('formats existing clinics with their saved map link first', () => {
    expect(
      formatClinicMapInput({
        latitude: 36.7525,
        longitude: 3.0419,
        mapUrl: 'https://maps.app.goo.gl/abc123',
      }),
    ).toBe('https://maps.app.goo.gl/abc123');
  });

  test('builds a patient map URL from saved link or legacy coordinates', () => {
    expect(getClinicMapUrl({ mapUrl: 'https://maps.app.goo.gl/abc123' })).toBe(
      'https://maps.app.goo.gl/abc123',
    );
    expect(getClinicMapUrl({ latitude: 36.7525, longitude: 3.0419 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=36.7525,3.0419',
    );
    expect(getClinicMapUrl({})).toBeNull();
  });
});
