/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

describe("locations seed", () => {
  test("makes every seeded wilaya resolve at least one commune", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.seed.seed, {});

    const wilayas = await t.query(api.locations.listWilayas, {});
    expect(wilayas).toHaveLength(58);

    for (const wilaya of wilayas) {
      const communes = await t.query(api.locations.listCommunesByWilaya, {
        wilayaId: wilaya._id,
      });

      expect(communes.length, wilaya.nameFr).toBeGreaterThan(0);
    }
  });

  test("seeds reusable demo doctors, clinics, schedules, and patient activity", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.seed.seed, {});

    const publicDoctors = await t.query(api.doctors.listPublic, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(publicDoctors.page.length).toBeGreaterThanOrEqual(3);
    expect(publicDoctors.page.map((doctor) => doctor.user.fullNameAr)).toEqual(
      expect.arrayContaining(["د. أمينة بن يوسف", "د. كريم منصوري", "د. ليلى حداد"]),
    );

    const firstDoctor = publicDoctors.page[0];
    const doctorDetail = await t.query(api.doctors.getById, {
      doctorId: firstDoctor._id,
    });
    expect(doctorDetail?.clinics.length).toBeGreaterThan(0);

    const schedules = await t.query(api.schedules.getByClinic, {
      clinicId: doctorDetail!.clinics[0]._id,
    });
    expect(schedules.length).toBeGreaterThan(0);

    const reviews = await t.query(api.reviews.listByDoctor, {
      doctorId: firstDoctor._id,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(reviews.page.length).toBeGreaterThan(0);

    const seededPatient = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "demo.patient@nabdh.test"))
        .unique();
      if (!user) return null;

      const patient = await ctx.db
        .query("patients")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (!patient) return null;

      const [profiles, bookings, favorites] = await Promise.all([
        ctx.db
          .query("patientProfiles")
          .withIndex("by_parentUserId", (q) => q.eq("parentUserId", user._id))
          .collect(),
        ctx.db
          .query("bookings")
          .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
          .collect(),
        ctx.db
          .query("patientFavorites")
          .withIndex("by_patientId", (q) => q.eq("patientId", patient._id))
          .collect(),
      ]);

      return { profiles, bookings, favorites };
    });

    expect(seededPatient?.profiles.length).toBeGreaterThan(0);
    expect(seededPatient?.bookings.length).toBeGreaterThan(0);
    expect(seededPatient?.favorites.length).toBeGreaterThan(0);

    await t.mutation(internal.seed.seed, {});

    const duplicateCheck = await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      const doctors = await ctx.db.query("doctors").collect();
      const clinics = await ctx.db.query("clinics").collect();
      const bookings = await ctx.db.query("bookings").collect();
      return {
        demoUserCount: users.filter((user) => user.email?.endsWith("@nabdh.test")).length,
        doctorCount: doctors.length,
        clinicCount: clinics.length,
        bookingCount: bookings.length,
      };
    });

    expect(duplicateCheck.demoUserCount).toBe(4);
    expect(duplicateCheck.doctorCount).toBe(3);
    expect(duplicateCheck.clinicCount).toBe(4);
    expect(duplicateCheck.bookingCount).toBeGreaterThanOrEqual(3);
  });
});
