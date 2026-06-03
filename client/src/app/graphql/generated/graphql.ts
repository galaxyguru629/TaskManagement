import { gql } from 'apollo-angular';
import { Injectable } from '@angular/core';
import * as Apollo from 'apollo-angular';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type ActivityItem = {
  __typename?: 'ActivityItem';
  actor: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  taskId?: Maybe<Scalars['ID']['output']>;
  type: Scalars['String']['output'];
};

export type Board = {
  __typename?: 'Board';
  background: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdByAuth0Sub: Scalars['ID']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type BoardCard = {
  __typename?: 'BoardCard';
  archived: Scalars['Boolean']['output'];
  assignees: Array<Scalars['String']['output']>;
  boardId: Scalars['ID']['output'];
  checklist: Array<ChecklistItem>;
  comments: Array<TaskComment>;
  coverColor?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dueDate?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  labels: Array<Label>;
  listId: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  priority: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type BoardEvent = {
  __typename?: 'BoardEvent';
  activity?: Maybe<ActivityItem>;
  actorId?: Maybe<Scalars['String']['output']>;
  actorName?: Maybe<Scalars['String']['output']>;
  boardId: Scalars['ID']['output'];
  checklistItem?: Maybe<ChecklistItem>;
  clientMutationId?: Maybe<Scalars['String']['output']>;
  comment?: Maybe<TaskComment>;
  label?: Maybe<Label>;
  list?: Maybe<TaskList>;
  task?: Maybe<Task>;
  type: BoardEventType;
};

export enum BoardEventType {
  BoardUpdated = 'BOARD_UPDATED',
  CardArchived = 'CARD_ARCHIVED',
  CardCreated = 'CARD_CREATED',
  CardDeleted = 'CARD_DELETED',
  CardMoved = 'CARD_MOVED',
  CardUpdated = 'CARD_UPDATED',
  ChecklistItemDeleted = 'CHECKLIST_ITEM_DELETED',
  ChecklistUpdated = 'CHECKLIST_UPDATED',
  CommentCreated = 'COMMENT_CREATED',
  LabelUpdated = 'LABEL_UPDATED',
  ListArchived = 'LIST_ARCHIVED',
  ListCreated = 'LIST_CREATED',
  ListUpdated = 'LIST_UPDATED'
}

export type BoardInvitation = {
  __typename?: 'BoardInvitation';
  acceptedBy?: Maybe<Scalars['String']['output']>;
  boardBackground: Scalars['String']['output'];
  boardId: Scalars['ID']['output'];
  boardTitle: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invitedBy: Scalars['String']['output'];
  role: BoardRole;
  status: InvitationStatus;
  updatedAt: Scalars['String']['output'];
};

export type BoardList = {
  __typename?: 'BoardList';
  archived: Scalars['Boolean']['output'];
  boardId: Scalars['ID']['output'];
  cards: Array<BoardCard>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type BoardMember = {
  __typename?: 'BoardMember';
  auth0Sub: Scalars['ID']['output'];
  boardId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  invitedBy?: Maybe<Scalars['String']['output']>;
  pictureUrl?: Maybe<Scalars['String']['output']>;
  role: BoardRole;
};

export type BoardMutationResult = {
  __typename?: 'BoardMutationResult';
  board?: Maybe<Board>;
  conflict: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
};

export enum BoardRole {
  Admin = 'ADMIN',
  Member = 'MEMBER',
  Owner = 'OWNER'
}

export type BoardView = {
  __typename?: 'BoardView';
  activity: Array<ActivityItem>;
  board: Board;
  labels: Array<Label>;
  lists: Array<BoardList>;
};

export type ChecklistItem = {
  __typename?: 'ChecklistItem';
  checked: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  taskId: Scalars['ID']['output'];
  text: Scalars['String']['output'];
};

export type ChecklistItemDeleteResult = {
  __typename?: 'ChecklistItemDeleteResult';
  checklistItem: ChecklistItem;
  success: Scalars['Boolean']['output'];
};

export type CreateBoardInput = {
  background?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  logoImageData?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateListInput = {
  boardId: Scalars['ID']['input'];
  position?: InputMaybe<Scalars['Float']['input']>;
  title: Scalars['String']['input'];
};

export type CreateTaskInput = {
  assignees?: InputMaybe<Array<Scalars['String']['input']>>;
  boardId?: InputMaybe<Scalars['ID']['input']>;
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  coverColor?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  listId?: InputMaybe<Scalars['ID']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  title: Scalars['String']['input'];
};

export enum InvitationStatus {
  Accepted = 'ACCEPTED',
  Declined = 'DECLINED',
  Expired = 'EXPIRED',
  Pending = 'PENDING',
  Revoked = 'REVOKED'
}

export type InviteMemberInput = {
  boardId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
  expiresInDays?: InputMaybe<Scalars['Int']['input']>;
  role?: InputMaybe<BoardRole>;
};

export type Label = {
  __typename?: 'Label';
  boardId: Scalars['ID']['output'];
  color: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type ListMutationResult = {
  __typename?: 'ListMutationResult';
  conflict: Scalars['Boolean']['output'];
  list?: Maybe<TaskList>;
  success: Scalars['Boolean']['output'];
};

export type MoveTaskInput = {
  boardId: Scalars['ID']['input'];
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  position: Scalars['Float']['input'];
  taskId: Scalars['ID']['input'];
  toListId: Scalars['ID']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  acceptInvitation: BoardInvitation;
  addComment: TaskComment;
  createBoard: Board;
  createChecklistItem: ChecklistItem;
  createLabel: Label;
  createList: TaskList;
  createTask: Task;
  declineInvitation: BoardInvitation;
  deleteChecklistItem: ChecklistItemDeleteResult;
  deleteTask: TaskDeleteResult;
  inviteMember: BoardInvitation;
  moveTask: TaskUpdateResult;
  setTaskLabels?: Maybe<Task>;
  updateBoard: BoardMutationResult;
  updateChecklistItem?: Maybe<ChecklistItem>;
  updateList: ListMutationResult;
  updateMyProfile: UserProfile;
  updateTask: TaskUpdateResult;
};


export type MutationAcceptInvitationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAddCommentArgs = {
  body: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
};


export type MutationCreateBoardArgs = {
  input: CreateBoardInput;
};


export type MutationCreateChecklistItemArgs = {
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  taskId: Scalars['ID']['input'];
  text: Scalars['String']['input'];
};


export type MutationCreateLabelArgs = {
  boardId: Scalars['ID']['input'];
  color: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateListArgs = {
  input: CreateListInput;
};


export type MutationCreateTaskArgs = {
  input: CreateTaskInput;
};


export type MutationDeclineInvitationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteChecklistItemArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTaskArgs = {
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationInviteMemberArgs = {
  input: InviteMemberInput;
};


export type MutationMoveTaskArgs = {
  input: MoveTaskInput;
};


export type MutationSetTaskLabelsArgs = {
  labelIds: Array<Scalars['ID']['input']>;
  taskId: Scalars['ID']['input'];
};


export type MutationUpdateBoardArgs = {
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  input: UpdateBoardInput;
};


export type MutationUpdateChecklistItemArgs = {
  checked?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateListArgs = {
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  input: UpdateListInput;
};


export type MutationUpdateMyProfileArgs = {
  input: UpdateMyProfileInput;
};


export type MutationUpdateTaskArgs = {
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  board?: Maybe<Board>;
  boardInvitations: Array<BoardInvitation>;
  boardMembers: Array<BoardMember>;
  boardView?: Maybe<BoardView>;
  boards: Array<Board>;
  defaultBoard?: Maybe<Board>;
  health: Scalars['String']['output'];
  me?: Maybe<UserProfile>;
  myInvitations: Array<BoardInvitation>;
  projectUsers: Array<UserProfile>;
  task?: Maybe<Task>;
  tasks: TaskConnection;
};


export type QueryBoardArgs = {
  id: Scalars['ID']['input'];
};


export type QueryBoardInvitationsArgs = {
  boardId: Scalars['ID']['input'];
};


export type QueryBoardMembersArgs = {
  boardId: Scalars['ID']['input'];
};


export type QueryBoardViewArgs = {
  boardId: Scalars['ID']['input'];
};


export type QueryProjectUsersArgs = {
  boardId: Scalars['ID']['input'];
};


export type QueryTaskArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTasksArgs = {
  filter?: InputMaybe<TaskFilterInput>;
  page?: Scalars['Int']['input'];
  pageSize?: Scalars['Int']['input'];
  sort?: InputMaybe<Array<TaskSortInput>>;
};

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type Subscription = {
  __typename?: 'Subscription';
  boardChanged: BoardEvent;
  taskChanged: TaskEvent;
};


export type SubscriptionBoardChangedArgs = {
  boardId: Scalars['ID']['input'];
};

export type Task = {
  __typename?: 'Task';
  archived: Scalars['Boolean']['output'];
  assignees: Array<Scalars['String']['output']>;
  boardId: Scalars['ID']['output'];
  coverColor?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dueDate?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  listId: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  priority: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type TaskComment = {
  __typename?: 'TaskComment';
  author: Scalars['String']['output'];
  body: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  taskId: Scalars['ID']['output'];
};

export type TaskConnection = {
  __typename?: 'TaskConnection';
  nodes: Array<Task>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type TaskDeleteResult = {
  __typename?: 'TaskDeleteResult';
  conflict: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
  task?: Maybe<Task>;
};

export type TaskEvent = {
  __typename?: 'TaskEvent';
  task: Task;
  type: TaskEventType;
};

export enum TaskEventType {
  Created = 'CREATED',
  Deleted = 'DELETED',
  Updated = 'UPDATED'
}

export type TaskFilterInput = {
  search?: InputMaybe<Scalars['String']['input']>;
};

export type TaskList = {
  __typename?: 'TaskList';
  archived: Scalars['Boolean']['output'];
  boardId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type TaskSortInput = {
  direction: SortDirection;
  field: Scalars['String']['input'];
};

export type TaskUpdateResult = {
  __typename?: 'TaskUpdateResult';
  conflict: Scalars['Boolean']['output'];
  success: Scalars['Boolean']['output'];
  task?: Maybe<Task>;
};

export type UpdateBoardInput = {
  background?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateListInput = {
  archived?: InputMaybe<Scalars['Boolean']['input']>;
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateMyProfileInput = {
  displayName: Scalars['String']['input'];
  pictureUrl?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskInput = {
  archived?: InputMaybe<Scalars['Boolean']['input']>;
  assignees?: InputMaybe<Array<Scalars['String']['input']>>;
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  coverColor?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  listId?: InputMaybe<Scalars['ID']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UserProfile = {
  __typename?: 'UserProfile';
  auth0Sub: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  email?: Maybe<Scalars['String']['output']>;
  isOnboarded: Scalars['Boolean']['output'];
  lastSeenAt?: Maybe<Scalars['String']['output']>;
  pictureUrl?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type BoardFieldsFragment = { __typename?: 'Board', id: string, title: string, description?: string | null, background: string, logoUrl?: string | null, createdByAuth0Sub: string, version: number, createdAt: string, updatedAt: string };

export type LabelFieldsFragment = { __typename?: 'Label', id: string, boardId: string, name: string, color: string };

export type BoardMemberFieldsFragment = { __typename?: 'BoardMember', boardId: string, auth0Sub: string, role: BoardRole, displayName?: string | null, email?: string | null, pictureUrl?: string | null, invitedBy?: string | null, createdAt: string };

export type BoardInvitationFieldsFragment = { __typename?: 'BoardInvitation', id: string, boardId: string, boardTitle: string, boardBackground: string, email: string, role: BoardRole, status: InvitationStatus, invitedBy: string, acceptedBy?: string | null, expiresAt: string, createdAt: string, updatedAt: string };

export type InviteUserFieldsFragment = { __typename?: 'UserProfile', auth0Sub: string, displayName: string, email?: string | null, pictureUrl?: string | null };

export type ChecklistItemFieldsFragment = { __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number };

export type CommentFieldsFragment = { __typename?: 'TaskComment', id: string, taskId: string, body: string, author: string, createdAt: string };

export type ActivityFieldsFragment = { __typename?: 'ActivityItem', id: string, taskId?: string | null, type: string, message: string, actor: string, createdAt: string };

export type CardFieldsFragment = { __typename?: 'BoardCard', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string, labels: Array<{ __typename?: 'Label', id: string, boardId: string, name: string, color: string }>, checklist: Array<{ __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number }>, comments: Array<{ __typename?: 'TaskComment', id: string, taskId: string, body: string, author: string, createdAt: string }> };

export type TaskFieldsFragment = { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string };

export type ListFieldsFragment = { __typename?: 'BoardList', id: string, boardId: string, title: string, position: number, archived: boolean, version: number, createdAt: string, updatedAt: string, cards: Array<{ __typename?: 'BoardCard', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string, labels: Array<{ __typename?: 'Label', id: string, boardId: string, name: string, color: string }>, checklist: Array<{ __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number }>, comments: Array<{ __typename?: 'TaskComment', id: string, taskId: string, body: string, author: string, createdAt: string }> }> };

export type DefaultBoardQueryVariables = Exact<{ [key: string]: never; }>;


export type DefaultBoardQuery = { __typename?: 'Query', defaultBoard?: { __typename?: 'Board', id: string, title: string, description?: string | null, background: string, logoUrl?: string | null, createdByAuth0Sub: string, version: number, createdAt: string, updatedAt: string } | null };

export type BoardsQueryVariables = Exact<{ [key: string]: never; }>;


export type BoardsQuery = { __typename?: 'Query', boards: Array<{ __typename?: 'Board', id: string, title: string, description?: string | null, background: string, logoUrl?: string | null, createdByAuth0Sub: string, version: number, createdAt: string, updatedAt: string }> };

export type BoardMembersQueryVariables = Exact<{
  boardId: Scalars['ID']['input'];
}>;


export type BoardMembersQuery = { __typename?: 'Query', boardMembers: Array<{ __typename?: 'BoardMember', boardId: string, auth0Sub: string, role: BoardRole, displayName?: string | null, email?: string | null, pictureUrl?: string | null, invitedBy?: string | null, createdAt: string }> };

export type BoardInvitationsQueryVariables = Exact<{
  boardId: Scalars['ID']['input'];
}>;


export type BoardInvitationsQuery = { __typename?: 'Query', boardInvitations: Array<{ __typename?: 'BoardInvitation', id: string, boardId: string, boardTitle: string, boardBackground: string, email: string, role: BoardRole, status: InvitationStatus, invitedBy: string, acceptedBy?: string | null, expiresAt: string, createdAt: string, updatedAt: string }> };

export type ProjectUsersQueryVariables = Exact<{
  boardId: Scalars['ID']['input'];
}>;


export type ProjectUsersQuery = { __typename?: 'Query', projectUsers: Array<{ __typename?: 'UserProfile', auth0Sub: string, displayName: string, email?: string | null, pictureUrl?: string | null }> };

export type MyInvitationsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyInvitationsQuery = { __typename?: 'Query', myInvitations: Array<{ __typename?: 'BoardInvitation', id: string, boardId: string, boardTitle: string, boardBackground: string, email: string, role: BoardRole, status: InvitationStatus, invitedBy: string, acceptedBy?: string | null, expiresAt: string, createdAt: string, updatedAt: string }> };

export type BoardViewQueryVariables = Exact<{
  boardId: Scalars['ID']['input'];
}>;


export type BoardViewQuery = { __typename?: 'Query', boardView?: { __typename?: 'BoardView', board: { __typename?: 'Board', id: string, title: string, description?: string | null, background: string, logoUrl?: string | null, createdByAuth0Sub: string, version: number, createdAt: string, updatedAt: string }, lists: Array<{ __typename?: 'BoardList', id: string, boardId: string, title: string, position: number, archived: boolean, version: number, createdAt: string, updatedAt: string, cards: Array<{ __typename?: 'BoardCard', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string, labels: Array<{ __typename?: 'Label', id: string, boardId: string, name: string, color: string }>, checklist: Array<{ __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number }>, comments: Array<{ __typename?: 'TaskComment', id: string, taskId: string, body: string, author: string, createdAt: string }> }> }>, labels: Array<{ __typename?: 'Label', id: string, boardId: string, name: string, color: string }>, activity: Array<{ __typename?: 'ActivityItem', id: string, taskId?: string | null, type: string, message: string, actor: string, createdAt: string }> } | null };

export type CreateListMutationVariables = Exact<{
  input: CreateListInput;
}>;


export type CreateListMutation = { __typename?: 'Mutation', createList: { __typename?: 'TaskList', id: string, boardId: string, title: string, position: number, archived: boolean, version: number, createdAt: string, updatedAt: string } };

export type CreateBoardMutationVariables = Exact<{
  input: CreateBoardInput;
}>;


export type CreateBoardMutation = { __typename?: 'Mutation', createBoard: { __typename?: 'Board', id: string, title: string, description?: string | null, background: string, logoUrl?: string | null, createdByAuth0Sub: string, version: number, createdAt: string, updatedAt: string } };

export type InviteMemberMutationVariables = Exact<{
  input: InviteMemberInput;
}>;


export type InviteMemberMutation = { __typename?: 'Mutation', inviteMember: { __typename?: 'BoardInvitation', id: string, boardId: string, boardTitle: string, boardBackground: string, email: string, role: BoardRole, status: InvitationStatus, invitedBy: string, acceptedBy?: string | null, expiresAt: string, createdAt: string, updatedAt: string } };

export type AcceptInvitationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type AcceptInvitationMutation = { __typename?: 'Mutation', acceptInvitation: { __typename?: 'BoardInvitation', id: string, boardId: string, boardTitle: string, boardBackground: string, email: string, role: BoardRole, status: InvitationStatus, invitedBy: string, acceptedBy?: string | null, expiresAt: string, createdAt: string, updatedAt: string } };

export type DeclineInvitationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeclineInvitationMutation = { __typename?: 'Mutation', declineInvitation: { __typename?: 'BoardInvitation', id: string, boardId: string, boardTitle: string, boardBackground: string, email: string, role: BoardRole, status: InvitationStatus, invitedBy: string, acceptedBy?: string | null, expiresAt: string, createdAt: string, updatedAt: string } };

export type UpdateListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateListInput;
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpdateListMutation = { __typename?: 'Mutation', updateList: { __typename?: 'ListMutationResult', success: boolean, conflict: boolean, list?: { __typename?: 'TaskList', id: string, boardId: string, title: string, position: number, archived: boolean, version: number, createdAt: string, updatedAt: string } | null } };

export type CreateTaskMutationVariables = Exact<{
  input: CreateTaskInput;
}>;


export type CreateTaskMutation = { __typename?: 'Mutation', createTask: { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string } };

export type UpdateTaskMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpdateTaskMutation = { __typename?: 'Mutation', updateTask: { __typename?: 'TaskUpdateResult', success: boolean, conflict: boolean, task?: { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string } | null } };

export type MoveTaskMutationVariables = Exact<{
  input: MoveTaskInput;
}>;


export type MoveTaskMutation = { __typename?: 'Mutation', moveTask: { __typename?: 'TaskUpdateResult', success: boolean, conflict: boolean, task?: { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string } | null } };

export type DeleteTaskMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  expectedVersion?: InputMaybe<Scalars['Int']['input']>;
}>;


export type DeleteTaskMutation = { __typename?: 'Mutation', deleteTask: { __typename?: 'TaskDeleteResult', success: boolean, conflict: boolean, task?: { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string } | null } };

export type CreateLabelMutationVariables = Exact<{
  boardId: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  color: Scalars['String']['input'];
}>;


export type CreateLabelMutation = { __typename?: 'Mutation', createLabel: { __typename?: 'Label', id: string, boardId: string, name: string, color: string } };

export type SetTaskLabelsMutationVariables = Exact<{
  taskId: Scalars['ID']['input'];
  labelIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type SetTaskLabelsMutation = { __typename?: 'Mutation', setTaskLabels?: { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string } | null };

export type CreateChecklistItemMutationVariables = Exact<{
  taskId: Scalars['ID']['input'];
  text: Scalars['String']['input'];
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateChecklistItemMutation = { __typename?: 'Mutation', createChecklistItem: { __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number } };

export type UpdateChecklistItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
  checked?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateChecklistItemMutation = { __typename?: 'Mutation', updateChecklistItem?: { __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number } | null };

export type DeleteChecklistItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteChecklistItemMutation = { __typename?: 'Mutation', deleteChecklistItem: { __typename?: 'ChecklistItemDeleteResult', success: boolean, checklistItem: { __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number } } };

export type AddCommentMutationVariables = Exact<{
  taskId: Scalars['ID']['input'];
  body: Scalars['String']['input'];
}>;


export type AddCommentMutation = { __typename?: 'Mutation', addComment: { __typename?: 'TaskComment', id: string, taskId: string, body: string, author: string, createdAt: string } };

export type BoardChangedSubscriptionVariables = Exact<{
  boardId: Scalars['ID']['input'];
}>;


export type BoardChangedSubscription = { __typename?: 'Subscription', boardChanged: { __typename?: 'BoardEvent', type: BoardEventType, boardId: string, clientMutationId?: string | null, actorId?: string | null, actorName?: string | null, task?: { __typename?: 'Task', id: string, boardId: string, listId: string, title: string, description?: string | null, priority: number, assignees: Array<string>, position: number, dueDate?: string | null, coverColor?: string | null, archived: boolean, version: number, updatedAt: string } | null, list?: { __typename?: 'TaskList', id: string, boardId: string, title: string, position: number, archived: boolean, version: number, createdAt: string, updatedAt: string } | null, label?: { __typename?: 'Label', id: string, boardId: string, name: string, color: string } | null, comment?: { __typename?: 'TaskComment', id: string, taskId: string, body: string, author: string, createdAt: string } | null, checklistItem?: { __typename?: 'ChecklistItem', id: string, taskId: string, text: string, checked: boolean, position: number } | null, activity?: { __typename?: 'ActivityItem', id: string, taskId?: string | null, type: string, message: string, actor: string, createdAt: string } | null } };

export type UserProfileFieldsFragment = { __typename?: 'UserProfile', auth0Sub: string, displayName: string, email?: string | null, pictureUrl?: string | null, isOnboarded: boolean, lastSeenAt?: string | null, createdAt: string, updatedAt: string };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'UserProfile', auth0Sub: string, displayName: string, email?: string | null, pictureUrl?: string | null, isOnboarded: boolean, lastSeenAt?: string | null, createdAt: string, updatedAt: string } | null };

export type UpdateMyProfileMutationVariables = Exact<{
  input: UpdateMyProfileInput;
}>;


export type UpdateMyProfileMutation = { __typename?: 'Mutation', updateMyProfile: { __typename?: 'UserProfile', auth0Sub: string, displayName: string, email?: string | null, pictureUrl?: string | null, isOnboarded: boolean, lastSeenAt?: string | null, createdAt: string, updatedAt: string } };

export const BoardFieldsFragmentDoc = gql`
    fragment BoardFields on Board {
  id
  title
  description
  background
  logoUrl
  createdByAuth0Sub
  version
  createdAt
  updatedAt
}
    `;
export const BoardMemberFieldsFragmentDoc = gql`
    fragment BoardMemberFields on BoardMember {
  boardId
  auth0Sub
  role
  displayName
  email
  pictureUrl
  invitedBy
  createdAt
}
    `;
export const BoardInvitationFieldsFragmentDoc = gql`
    fragment BoardInvitationFields on BoardInvitation {
  id
  boardId
  boardTitle
  boardBackground
  email
  role
  status
  invitedBy
  acceptedBy
  expiresAt
  createdAt
  updatedAt
}
    `;
export const InviteUserFieldsFragmentDoc = gql`
    fragment InviteUserFields on UserProfile {
  auth0Sub
  displayName
  email
  pictureUrl
}
    `;
export const ActivityFieldsFragmentDoc = gql`
    fragment ActivityFields on ActivityItem {
  id
  taskId
  type
  message
  actor
  createdAt
}
    `;
export const TaskFieldsFragmentDoc = gql`
    fragment TaskFields on Task {
  id
  boardId
  listId
  title
  description
  priority
  assignees
  position
  dueDate
  coverColor
  archived
  version
  updatedAt
}
    `;
export const LabelFieldsFragmentDoc = gql`
    fragment LabelFields on Label {
  id
  boardId
  name
  color
}
    `;
export const ChecklistItemFieldsFragmentDoc = gql`
    fragment ChecklistItemFields on ChecklistItem {
  id
  taskId
  text
  checked
  position
}
    `;
export const CommentFieldsFragmentDoc = gql`
    fragment CommentFields on TaskComment {
  id
  taskId
  body
  author
  createdAt
}
    `;
export const CardFieldsFragmentDoc = gql`
    fragment CardFields on BoardCard {
  id
  boardId
  listId
  title
  description
  priority
  assignees
  position
  dueDate
  coverColor
  archived
  version
  updatedAt
  labels {
    ...LabelFields
  }
  checklist {
    ...ChecklistItemFields
  }
  comments {
    ...CommentFields
  }
}
    ${LabelFieldsFragmentDoc}
${ChecklistItemFieldsFragmentDoc}
${CommentFieldsFragmentDoc}`;
export const ListFieldsFragmentDoc = gql`
    fragment ListFields on BoardList {
  id
  boardId
  title
  position
  archived
  version
  createdAt
  updatedAt
  cards {
    ...CardFields
  }
}
    ${CardFieldsFragmentDoc}`;
export const UserProfileFieldsFragmentDoc = gql`
    fragment UserProfileFields on UserProfile {
  auth0Sub
  displayName
  email
  pictureUrl
  isOnboarded
  lastSeenAt
  createdAt
  updatedAt
}
    `;
export const DefaultBoardDocument = gql`
    query DefaultBoard {
  defaultBoard {
    ...BoardFields
  }
}
    ${BoardFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class DefaultBoardGQL extends Apollo.Query<DefaultBoardQuery, DefaultBoardQueryVariables> {
    override document = DefaultBoardDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const BoardsDocument = gql`
    query Boards {
  boards {
    ...BoardFields
  }
}
    ${BoardFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class BoardsGQL extends Apollo.Query<BoardsQuery, BoardsQueryVariables> {
    override document = BoardsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const BoardMembersDocument = gql`
    query BoardMembers($boardId: ID!) {
  boardMembers(boardId: $boardId) {
    ...BoardMemberFields
  }
}
    ${BoardMemberFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class BoardMembersGQL extends Apollo.Query<BoardMembersQuery, BoardMembersQueryVariables> {
    override document = BoardMembersDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const BoardInvitationsDocument = gql`
    query BoardInvitations($boardId: ID!) {
  boardInvitations(boardId: $boardId) {
    ...BoardInvitationFields
  }
}
    ${BoardInvitationFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class BoardInvitationsGQL extends Apollo.Query<BoardInvitationsQuery, BoardInvitationsQueryVariables> {
    override document = BoardInvitationsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const ProjectUsersDocument = gql`
    query ProjectUsers($boardId: ID!) {
  projectUsers(boardId: $boardId) {
    ...InviteUserFields
  }
}
    ${InviteUserFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class ProjectUsersGQL extends Apollo.Query<ProjectUsersQuery, ProjectUsersQueryVariables> {
    override document = ProjectUsersDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const MyInvitationsDocument = gql`
    query MyInvitations {
  myInvitations {
    ...BoardInvitationFields
  }
}
    ${BoardInvitationFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class MyInvitationsGQL extends Apollo.Query<MyInvitationsQuery, MyInvitationsQueryVariables> {
    override document = MyInvitationsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const BoardViewDocument = gql`
    query BoardView($boardId: ID!) {
  boardView(boardId: $boardId) {
    board {
      ...BoardFields
    }
    lists {
      ...ListFields
    }
    labels {
      ...LabelFields
    }
    activity {
      ...ActivityFields
    }
  }
}
    ${BoardFieldsFragmentDoc}
${ListFieldsFragmentDoc}
${LabelFieldsFragmentDoc}
${ActivityFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class BoardViewGQL extends Apollo.Query<BoardViewQuery, BoardViewQueryVariables> {
    override document = BoardViewDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateListDocument = gql`
    mutation CreateList($input: CreateListInput!) {
  createList(input: $input) {
    id
    boardId
    title
    position
    archived
    version
    createdAt
    updatedAt
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateListGQL extends Apollo.Mutation<CreateListMutation, CreateListMutationVariables> {
    override document = CreateListDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateBoardDocument = gql`
    mutation CreateBoard($input: CreateBoardInput!) {
  createBoard(input: $input) {
    ...BoardFields
  }
}
    ${BoardFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateBoardGQL extends Apollo.Mutation<CreateBoardMutation, CreateBoardMutationVariables> {
    override document = CreateBoardDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const InviteMemberDocument = gql`
    mutation InviteMember($input: InviteMemberInput!) {
  inviteMember(input: $input) {
    ...BoardInvitationFields
  }
}
    ${BoardInvitationFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class InviteMemberGQL extends Apollo.Mutation<InviteMemberMutation, InviteMemberMutationVariables> {
    override document = InviteMemberDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const AcceptInvitationDocument = gql`
    mutation AcceptInvitation($id: ID!) {
  acceptInvitation(id: $id) {
    ...BoardInvitationFields
  }
}
    ${BoardInvitationFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class AcceptInvitationGQL extends Apollo.Mutation<AcceptInvitationMutation, AcceptInvitationMutationVariables> {
    override document = AcceptInvitationDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DeclineInvitationDocument = gql`
    mutation DeclineInvitation($id: ID!) {
  declineInvitation(id: $id) {
    ...BoardInvitationFields
  }
}
    ${BoardInvitationFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class DeclineInvitationGQL extends Apollo.Mutation<DeclineInvitationMutation, DeclineInvitationMutationVariables> {
    override document = DeclineInvitationDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateListDocument = gql`
    mutation UpdateList($id: ID!, $input: UpdateListInput!, $expectedVersion: Int) {
  updateList(id: $id, input: $input, expectedVersion: $expectedVersion) {
    success
    conflict
    list {
      id
      boardId
      title
      position
      archived
      version
      createdAt
      updatedAt
    }
  }
}
    `;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateListGQL extends Apollo.Mutation<UpdateListMutation, UpdateListMutationVariables> {
    override document = UpdateListDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateTaskDocument = gql`
    mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    ...TaskFields
  }
}
    ${TaskFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateTaskGQL extends Apollo.Mutation<CreateTaskMutation, CreateTaskMutationVariables> {
    override document = CreateTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateTaskDocument = gql`
    mutation UpdateTask($id: ID!, $input: UpdateTaskInput!, $expectedVersion: Int) {
  updateTask(id: $id, input: $input, expectedVersion: $expectedVersion) {
    success
    conflict
    task {
      ...TaskFields
    }
  }
}
    ${TaskFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateTaskGQL extends Apollo.Mutation<UpdateTaskMutation, UpdateTaskMutationVariables> {
    override document = UpdateTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const MoveTaskDocument = gql`
    mutation MoveTask($input: MoveTaskInput!) {
  moveTask(input: $input) {
    success
    conflict
    task {
      ...TaskFields
    }
  }
}
    ${TaskFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class MoveTaskGQL extends Apollo.Mutation<MoveTaskMutation, MoveTaskMutationVariables> {
    override document = MoveTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DeleteTaskDocument = gql`
    mutation DeleteTask($id: ID!, $expectedVersion: Int) {
  deleteTask(id: $id, expectedVersion: $expectedVersion) {
    success
    conflict
    task {
      ...TaskFields
    }
  }
}
    ${TaskFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class DeleteTaskGQL extends Apollo.Mutation<DeleteTaskMutation, DeleteTaskMutationVariables> {
    override document = DeleteTaskDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateLabelDocument = gql`
    mutation CreateLabel($boardId: ID!, $name: String, $color: String!) {
  createLabel(boardId: $boardId, name: $name, color: $color) {
    ...LabelFields
  }
}
    ${LabelFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateLabelGQL extends Apollo.Mutation<CreateLabelMutation, CreateLabelMutationVariables> {
    override document = CreateLabelDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const SetTaskLabelsDocument = gql`
    mutation SetTaskLabels($taskId: ID!, $labelIds: [ID!]!) {
  setTaskLabels(taskId: $taskId, labelIds: $labelIds) {
    ...TaskFields
  }
}
    ${TaskFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class SetTaskLabelsGQL extends Apollo.Mutation<SetTaskLabelsMutation, SetTaskLabelsMutationVariables> {
    override document = SetTaskLabelsDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const CreateChecklistItemDocument = gql`
    mutation CreateChecklistItem($taskId: ID!, $text: String!, $clientMutationId: String) {
  createChecklistItem(
    taskId: $taskId
    text: $text
    clientMutationId: $clientMutationId
  ) {
    ...ChecklistItemFields
  }
}
    ${ChecklistItemFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class CreateChecklistItemGQL extends Apollo.Mutation<CreateChecklistItemMutation, CreateChecklistItemMutationVariables> {
    override document = CreateChecklistItemDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateChecklistItemDocument = gql`
    mutation UpdateChecklistItem($id: ID!, $text: String, $checked: Boolean) {
  updateChecklistItem(id: $id, text: $text, checked: $checked) {
    ...ChecklistItemFields
  }
}
    ${ChecklistItemFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateChecklistItemGQL extends Apollo.Mutation<UpdateChecklistItemMutation, UpdateChecklistItemMutationVariables> {
    override document = UpdateChecklistItemDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const DeleteChecklistItemDocument = gql`
    mutation DeleteChecklistItem($id: ID!) {
  deleteChecklistItem(id: $id) {
    success
    checklistItem {
      ...ChecklistItemFields
    }
  }
}
    ${ChecklistItemFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class DeleteChecklistItemGQL extends Apollo.Mutation<DeleteChecklistItemMutation, DeleteChecklistItemMutationVariables> {
    override document = DeleteChecklistItemDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const AddCommentDocument = gql`
    mutation AddComment($taskId: ID!, $body: String!) {
  addComment(taskId: $taskId, body: $body) {
    ...CommentFields
  }
}
    ${CommentFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class AddCommentGQL extends Apollo.Mutation<AddCommentMutation, AddCommentMutationVariables> {
    override document = AddCommentDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const BoardChangedDocument = gql`
    subscription BoardChanged($boardId: ID!) {
  boardChanged(boardId: $boardId) {
    type
    boardId
    clientMutationId
    actorId
    actorName
    task {
      ...TaskFields
    }
    list {
      id
      boardId
      title
      position
      archived
      version
      createdAt
      updatedAt
    }
    label {
      ...LabelFields
    }
    comment {
      ...CommentFields
    }
    checklistItem {
      ...ChecklistItemFields
    }
    activity {
      ...ActivityFields
    }
  }
}
    ${TaskFieldsFragmentDoc}
${LabelFieldsFragmentDoc}
${CommentFieldsFragmentDoc}
${ChecklistItemFieldsFragmentDoc}
${ActivityFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class BoardChangedGQL extends Apollo.Subscription<BoardChangedSubscription, BoardChangedSubscriptionVariables> {
    override document = BoardChangedDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const MeDocument = gql`
    query Me {
  me {
    ...UserProfileFields
  }
}
    ${UserProfileFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class MeGQL extends Apollo.Query<MeQuery, MeQueryVariables> {
    override document = MeDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }
export const UpdateMyProfileDocument = gql`
    mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
  updateMyProfile(input: $input) {
    ...UserProfileFields
  }
}
    ${UserProfileFieldsFragmentDoc}`;

  @Injectable({
    providedIn: 'root'
  })
  export class UpdateMyProfileGQL extends Apollo.Mutation<UpdateMyProfileMutation, UpdateMyProfileMutationVariables> {
    override document = UpdateMyProfileDocument;
    
    constructor(apollo: Apollo.Apollo) {
      super(apollo);
    }
  }