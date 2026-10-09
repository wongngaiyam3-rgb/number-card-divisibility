import {sqliteTable,text,integer,uniqueIndex,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const competitions=sqliteTable('competitions',{
 id:text('id').primaryKey(),code:text('code').notNull(),ownerId:text('owner_id').notNull(),divisors:text('divisors').notNull(),length:integer('length').notNull(),cards:text('cards').notNull(),status:text('status').notNull().default('waiting'),createdAt:integer('created_at').notNull(),startedAt:integer('started_at'),
},table=>[uniqueIndex('competitions_code_unique').on(table.code),index('competitions_owner_created').on(table.ownerId,table.createdAt)]);
export const participants=sqliteTable('participants',{
 id:text('id').primaryKey(),competitionId:text('competition_id').notNull().references(()=>competitions.id),nickname:text('nickname').notNull(),tokenHash:text('token_hash').notNull(),joinedAt:integer('joined_at').notNull(),
},table=>[uniqueIndex('participants_token_unique').on(table.tokenHash),uniqueIndex('participants_competition_name').on(table.competitionId,table.nickname)]);
export const answers=sqliteTable('answers',{
 participantId:text('participant_id').notNull().references(()=>participants.id),value:text('value').notNull(),submittedAt:integer('submitted_at').notNull(),
},table=>[primaryKey({columns:[table.participantId,table.value]})]);
