import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError } from 'graphql';
import { requireUser } from './auth/auth.js';
import type { DbClient } from './db/pool.js';
import { pool } from './db/pool.js';
import type { GraphQLContext } from './graphql/context.js';
import {
  publishBoardEvent as publishPgBoardEvent,
  publishTaskEvent as publishPgTaskEvent,
  taskEventStream,
} from './subscriptions/task-events.js';
import {
  addComment,
  createBoard,
  inviteMember,
  createChecklistItem,
  createLabel,
  createList,
  createTask,
  declineInvitation,
  deleteChecklistItem,
  deleteTask,
  getBoard,
  getBoardForUser,
  getBoardRole,
  getBoardView,
  getDefaultBoardForUser,
  getTask,
  getTaskForUser,
  getUserProfile,
  listBoardInvitations,
  listProjectUsers,
  listMyPendingInvitations,
  listBoardMembers,
  listBoards,
  listBoardsForUser,
  listBoardIdsForUser,
  listTasksForUser,
  moveTask,
  profileActor,
  setTaskLabels,
  acceptInvitation,
  updateBoard,
  updateChecklistItem,
  updateList,
  updateTask,
  updateUserProfile,
  type BoardEvent,
  type TaskEvent,
} from './domain/index.js';
import {
  BoardEventType,
  BoardRole,
  CreateBoardInput,
  InviteMemberInput,
  CreateListInput,
  CreateTaskInput,
  TaskEventType,
  TaskFilterInput,
  TaskSortInput,
  UpdateBoardInput,
  UpdateListInput,
  UpdateTaskInput,
  type UpdateMyProfileInput,
  type UserProfile,
  type MoveTaskInput,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = existsSync(join(__dirname, 'schema.graphql'))
  ? join(__dirname, 'schema.graphql')
  : resolve(__dirname, '..', 'src', 'schema.graphql');
const typeDefs = readFileSync(schemaPath, 'utf-8');


interface ResolverDeps {
  db: DbClient;
  publishTaskEvent: (event: TaskEvent) => Promise<void>;
  publishBoardEvent: (event: BoardEvent) => Promise<void>;
  taskEvents: {
    subscribeTasks: () => AsyncIterable<{ taskChanged: TaskEvent }>;
    subscribeBoard: (boardId: string) => AsyncIterable<{ boardChanged: BoardEvent }>;
  };
}

const defaultDeps: ResolverDeps = {
  db: pool,
  publishTaskEvent: (event) => publishPgTaskEvent(pool, event),
  publishBoardEvent: (event) => publishPgBoardEvent(pool, event),
  taskEvents: taskEventStream,
};

function taskEventType(boardType: BoardEventType): TaskEventType {
  if (boardType === BoardEventType.CARD_CREATED) return TaskEventType.CREATED;
  if (boardType === BoardEventType.CARD_DELETED || boardType === BoardEventType.CARD_ARCHIVED) return TaskEventType.DELETED;
  return TaskEventType.UPDATED;
}

function boardEventSource(user: ReturnType<typeof requireUser>, clientMutationId?: string | null) {
  return {
    clientMutationId: clientMutationId ?? null,
    actorId: user.id,
    actorName: user.name ?? user.email ?? 'User',
  };
}

function profileRequiredError(): GraphQLError {
  return new GraphQLError('Complete your profile before using the board.', {
    extensions: { code: 'PROFILE_REQUIRED' },
  });
}

async function requireProfile(db: DbClient, context: GraphQLContext): Promise<UserProfile> {
  const user = requireUser(context);
  const profile = await getUserProfile(db, user);
  if (!profile || !profile.isOnboarded) {
    throw profileRequiredError();
  }
  return profile;
}

function forbiddenError(message = 'You do not have permission to access this board.'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });
}

async function requireBoardRole(db: DbClient, boardId: string, context: GraphQLContext, allowed: BoardRole[]): Promise<UserProfile> {
  const profile = await requireProfile(db, context);
  const role = await getBoardRole(db, boardId, profile.auth0Sub);
  if (!role || !allowed.includes(role)) {
    throw forbiddenError();
  }
  return profile;
}

async function boardIdForTask(db: DbClient, taskId: string): Promise<string | null> {
  const result = await db.query<{ board_id: string }>('SELECT board_id FROM tasks WHERE id = $1', [taskId]);
  return result.rows[0]?.board_id ?? null;
}

async function boardIdForList(db: DbClient, listId: string): Promise<string | null> {
  const result = await db.query<{ board_id: string }>('SELECT board_id FROM task_lists WHERE id = $1', [listId]);
  return result.rows[0]?.board_id ?? null;
}

async function publishCardEvents(
  deps: ResolverDeps,
  type: BoardEventType,
  task: NonNullable<BoardEvent['task']>,
  source?: ReturnType<typeof boardEventSource>,
  activity?: BoardEvent['activity'],
): Promise<void> {
  await deps.publishBoardEvent({ type, boardId: task.boardId, task, activity, ...source });
  await deps.publishTaskEvent({ type: taskEventType(type), task });
}

async function* filterTaskEventsForBoards(
  stream: AsyncIterable<{ taskChanged: TaskEvent }>,
  allowedBoardIds: Set<string>,
): AsyncIterable<{ taskChanged: TaskEvent }> {
  for await (const event of stream) {
    const boardId = event.taskChanged.task.boardId;
    if (allowedBoardIds.has(boardId)) {
      yield event;
    }
  }
}

export function createExecutableTaskSchema(deps: ResolverDeps = defaultDeps) {
  const resolvers = {
    Query: {
      health: () => 'ok',
      me: (_: unknown, __: unknown, context: GraphQLContext) => {
        const user = requireUser(context);
        return getUserProfile(deps.db, user);
      },
      boardMembers: async (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        return listBoardMembers(deps.db, boardId);
      },
      projectUsers: async (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        return listProjectUsers(deps.db);
      },
      boardInvitations: async (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN]);
        return listBoardInvitations(deps.db, boardId);
      },
      myInvitations: async (_: unknown, __: unknown, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        if (!profile.email) return [];
        return listMyPendingInvitations(deps.db, profile.email);
      },
      boards: async (_: unknown, __: unknown, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        return listBoardsForUser(deps.db, profile.auth0Sub);
      },
      board: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        return getBoardForUser(deps.db, id, profile.auth0Sub);
      },
      defaultBoard: async (_: unknown, __: unknown, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        return getDefaultBoardForUser(deps.db, profile.auth0Sub);
      },
      boardView: async (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        return getBoardView(deps.db, boardId);
      },
      task: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        return getTaskForUser(deps.db, id, profile.auth0Sub);
      },
      tasks: async (
        _: unknown,
        args: {
          page: number;
          pageSize: number;
          filter?: TaskFilterInput | null;
          sort?: TaskSortInput[] | null;
        },
        context: GraphQLContext,
      ) => {
        const profile = await requireProfile(deps.db, context);
        const page = Math.max(1, args.page);
        const pageSize = Math.min(100, Math.max(1, args.pageSize));
        const { nodes, totalCount } = await listTasksForUser(deps.db, profile.auth0Sub, page, pageSize, args.filter, args.sort);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        return {
          nodes,
          totalCount,
          pageInfo: {
            page,
            pageSize,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        };
      },
    },
    Mutation: {
      updateMyProfile: async (_: unknown, { input }: { input: UpdateMyProfileInput }, context: GraphQLContext) => {
        const user = requireUser(context);
        return updateUserProfile(deps.db, user, input);
      },
      inviteMember: async (_: unknown, { input }: { input: InviteMemberInput }, context: GraphQLContext) => {
        const profile = await requireBoardRole(deps.db, input.boardId, context, [BoardRole.OWNER, BoardRole.ADMIN]);
        const invitation = await inviteMember(deps.db, input, profile.auth0Sub);
        await deps.publishBoardEvent({
          type: BoardEventType.BOARD_UPDATED,
          boardId: invitation.boardId,
          ...boardEventSource(profileActor(profile)),
        });
        return invitation;
      },
      acceptInvitation: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        const invitation = await acceptInvitation(deps.db, id, profileActor(profile));
        if (!invitation) {
          throw new GraphQLError('Invitation not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await deps.publishBoardEvent({
          type: BoardEventType.BOARD_UPDATED,
          boardId: invitation.boardId,
          ...boardEventSource(profileActor(profile)),
        });
        return invitation;
      },
      declineInvitation: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        const profile = await requireProfile(deps.db, context);
        const invitation = await declineInvitation(deps.db, id, profileActor(profile));
        if (!invitation) {
          throw new GraphQLError('Invitation not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await deps.publishBoardEvent({
          type: BoardEventType.BOARD_UPDATED,
          boardId: invitation.boardId,
          ...boardEventSource(profileActor(profile)),
        });
        return invitation;
      },
      createBoard: async (_: unknown, { input }: { input: CreateBoardInput }, context: GraphQLContext) => {
        const user = profileActor(await requireProfile(deps.db, context));
        return createBoard(deps.db, input, user);
      },
      updateBoard: async (
        _: unknown,
        { id, input, expectedVersion }: { id: string; input: UpdateBoardInput; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        await requireBoardRole(deps.db, id, context, [BoardRole.OWNER, BoardRole.ADMIN]);
        const user = profileActor(await requireProfile(deps.db, context));
        const result = await updateBoard(deps.db, id, input, expectedVersion, user);
        if (result.board && !result.conflict) {
          await deps.publishBoardEvent({ type: BoardEventType.BOARD_UPDATED, boardId: result.board.id });
        }
        return { success: Boolean(result.board && !result.conflict), conflict: result.conflict, board: result.board };
      },
      createList: async (_: unknown, { input }: { input: CreateListInput }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, input.boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const list = await createList(deps.db, input, user);
        await deps.publishBoardEvent({ type: BoardEventType.LIST_CREATED, boardId: list.boardId, list, ...boardEventSource(user) });
        return list;
      },
      updateList: async (
        _: unknown,
        { id, input, expectedVersion }: { id: string; input: UpdateListInput; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        const boardId = await boardIdForList(deps.db, id);
        if (!boardId) {
          throw new GraphQLError('List not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const result = await updateList(deps.db, id, input, expectedVersion, user);
        if (result.list && !result.conflict) {
          await deps.publishBoardEvent({
            type: result.list.archived ? BoardEventType.LIST_ARCHIVED : BoardEventType.LIST_UPDATED,
            boardId: result.list.boardId,
            list: result.list,
            ...boardEventSource(user, input.clientMutationId),
          });
        }
        return { success: Boolean(result.list && !result.conflict), conflict: result.conflict, list: result.list };
      },
      createTask: async (_: unknown, { input }: { input: CreateTaskInput }, context: GraphQLContext) => {
        const boardId = input.boardId ?? (await getDefaultBoardForUser(deps.db, (await requireProfile(deps.db, context)).auth0Sub))?.id;
        if (!boardId) {
          throw new GraphQLError('No accessible board found for this user.', { extensions: { code: 'FORBIDDEN' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const task = await createTask(deps.db, input, user);
        await publishCardEvents(deps, BoardEventType.CARD_CREATED, task, boardEventSource(user, input.clientMutationId));
        return task;
      },
      updateTask: async (
        _: unknown,
        { id, input, expectedVersion }: { id: string; input: UpdateTaskInput; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        const boardId = await boardIdForTask(deps.db, id);
        if (!boardId) {
          throw new GraphQLError('Task not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const result = await updateTask(deps.db, id, input, expectedVersion, user);
        if (result.conflict) {
          return { success: false, conflict: true, task: result.task };
        }
        if (result.task) {
          await publishCardEvents(
            deps,
            result.task.archived ? BoardEventType.CARD_ARCHIVED : BoardEventType.CARD_UPDATED,
            result.task,
            boardEventSource(user, input.clientMutationId),
          );
        }
        return { success: Boolean(result.task), conflict: false, task: result.task };
      },
      moveTask: async (_: unknown, { input }: { input: MoveTaskInput }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, input.boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const result = await moveTask(deps.db, input, user);
        if (result.conflict) {
          return { success: false, conflict: true, task: result.task };
        }
        if (result.task) {
          await publishCardEvents(deps, BoardEventType.CARD_MOVED, result.task, boardEventSource(user, input.clientMutationId));
        }
        return { success: Boolean(result.task), conflict: false, task: result.task };
      },
      deleteTask: async (
        _: unknown,
        { id, expectedVersion }: { id: string; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        const boardId = await boardIdForTask(deps.db, id);
        if (!boardId) {
          throw new GraphQLError('Task not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const result = await deleteTask(deps.db, id, expectedVersion, user);
        if (result.conflict) {
          return { success: false, conflict: true, task: result.task };
        }
        if (result.task) {
          await publishCardEvents(deps, BoardEventType.CARD_ARCHIVED, result.task);
        }
        return { success: Boolean(result.task), conflict: false, task: result.task };
      },
      createLabel: async (_: unknown, { boardId, name, color }: { boardId: string; name?: string | null; color: string }, context: GraphQLContext) => {
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const label = await createLabel(deps.db, boardId, name, color, user);
        await deps.publishBoardEvent({ type: BoardEventType.LABEL_UPDATED, boardId, label, ...boardEventSource(user) });
        return label;
      },
      setTaskLabels: async (_: unknown, { taskId, labelIds }: { taskId: string; labelIds: string[] }, context: GraphQLContext) => {
        const boardId = await boardIdForTask(deps.db, taskId);
        if (!boardId) {
          throw new GraphQLError('Task not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const task = await setTaskLabels(deps.db, taskId, labelIds, user);
        if (task) {
          await publishCardEvents(deps, BoardEventType.LABEL_UPDATED, task);
        }
        return task;
      },
      createChecklistItem: async (
        _: unknown,
        { taskId, text, clientMutationId }: { taskId: string; text: string; clientMutationId?: string | null },
        context: GraphQLContext,
      ) => {
        const boardId = await boardIdForTask(deps.db, taskId);
        if (!boardId) {
          throw new GraphQLError('Task not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const item = await createChecklistItem(deps.db, taskId, text, user);
        await deps.publishBoardEvent({
          type: BoardEventType.CHECKLIST_UPDATED,
          boardId,
          checklistItem: item,
          ...boardEventSource(user, clientMutationId),
        });
        return item;
      },
      updateChecklistItem: async (_: unknown, { id, text, checked }: { id: string; text?: string | null; checked?: boolean | null }, context: GraphQLContext) => {
        const boardIdQuery = await deps.db.query<{ board_id: string }>(
          'SELECT t.board_id FROM checklist_items ci JOIN tasks t ON t.id = ci.task_id WHERE ci.id = $1',
          [id],
        );
        const boardId = boardIdQuery.rows[0]?.board_id ?? null;
        if (!boardId) {
          throw new GraphQLError('Checklist item not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const item = await updateChecklistItem(deps.db, id, text, checked, user);
        if (item) {
          await deps.publishBoardEvent({
            type: BoardEventType.CHECKLIST_UPDATED,
            boardId,
            checklistItem: item,
            ...boardEventSource(user),
          });
        }
        return item;
      },
      deleteChecklistItem: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        const boardIdQuery = await deps.db.query<{ board_id: string }>(
          'SELECT t.board_id FROM checklist_items ci JOIN tasks t ON t.id = ci.task_id WHERE ci.id = $1',
          [id],
        );
        const boardId = boardIdQuery.rows[0]?.board_id ?? null;
        if (!boardId) {
          throw new GraphQLError('Checklist item not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const item = await deleteChecklistItem(deps.db, id, user);
        if (!item) {
          throw new GraphQLError('Checklist item not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await deps.publishBoardEvent({
          type: BoardEventType.CHECKLIST_ITEM_DELETED,
          boardId,
          checklistItem: item,
          ...boardEventSource(user),
        });
        return { success: true, checklistItem: item };
      },
      addComment: async (_: unknown, { taskId, body }: { taskId: string; body: string }, context: GraphQLContext) => {
        const boardId = await boardIdForTask(deps.db, taskId);
        if (!boardId) {
          throw new GraphQLError('Task not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
        const user = profileActor(await requireProfile(deps.db, context));
        const comment = await addComment(deps.db, taskId, body, user);
        await deps.publishBoardEvent({
          type: BoardEventType.COMMENT_CREATED,
          boardId,
          comment,
          ...boardEventSource(user),
        });
        return comment;
      },
    },
    Subscription: {
      taskChanged: {
        subscribe: async (_: unknown, __: unknown, context: GraphQLContext) => {
          const profile = await requireProfile(deps.db, context);
          const boardIds = await listBoardIdsForUser(deps.db, profile.auth0Sub);
          return filterTaskEventsForBoards(deps.taskEvents.subscribeTasks(), new Set(boardIds));
        },
      },
      boardChanged: {
        subscribe: async (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
          await requireBoardRole(deps.db, boardId, context, [BoardRole.OWNER, BoardRole.ADMIN, BoardRole.MEMBER]);
          return deps.taskEvents.subscribeBoard(boardId);
        },
      },
    },
  };

  return makeExecutableSchema({ typeDefs, resolvers });
}

export const schema = createExecutableTaskSchema();
