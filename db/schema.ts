import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const eventState = sqliteTable('event_state', {
  id: integer('id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});
