# Doctor Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real doctor self-service account deletion flow that removes active doctor data, preserves historical booking and review rows in a detached state, and deletes the Clerk user from the client.

**Architecture:** Use a dedicated Convex mutation to cascade-delete live doctor-owned records in a safe order, cancel future bookings, and remove the `users`/`doctors` rows last. Then call Clerk `user.delete()` from the signed-in app client, sign out locally, and route back to auth.

**Tech Stack:** Expo Router, Clerk Expo, Convex mutations, Vitest, convex-test

---
