import { query, unwrap } from '../core';
import { toDoc, toDocs, wilayaIdToSql } from '../convert';

export const specialties = {
  list: query(async (ctx) => {
    const rows = unwrap(
      await ctx.db.from('specialties').select('id, name, icon, parent_id').order('name'),
    );
    return (rows as any[]).map((row) => ({
      _id: row.id,
      _creationTime: 0,
      name: row.name,
      icon: row.icon,
      ...(row.parent_id ? { parentId: row.parent_id } : {}),
    }));
  }),
};

export const locations = {
  listWilayas: query(async (ctx) => {
    const rows = unwrap(await ctx.db.from('wilayas').select('id, name').order('id'));
    return (rows as { id: number; name: string }[]).map((w) => ({
      _id: String(w.id),
      _creationTime: 0,
      id: w.id,
      name: w.name,
    }));
  }),

  listCommunesByWilaya: query(async (ctx, args: { wilayaId: string | number }) => {
    const rows = unwrap(
      await ctx.db
        .from('communes')
        .select('*')
        .eq('wilaya_id', wilayaIdToSql(args.wilayaId) ?? -1)
        .order('name'),
    );
    return toDocs(rows as unknown[]);
  }),
};

export { toDoc };
