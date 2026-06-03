import {
  BoardInvitationsQuery,
  BoardChangedSubscription,
  BoardMembersQuery,
  BoardEventType,
  BoardViewQuery,
} from '../../../graphql/generated/graphql';

export type BoardViewModel = NonNullable<BoardViewQuery['boardView']>;
export type BoardModel = BoardViewModel['board'];
export type BoardListModel = BoardViewModel['lists'][number];
export type BoardCardModel = BoardListModel['cards'][number];
export type BoardLabelModel = BoardViewModel['labels'][number];
export type BoardActivityModel = BoardViewModel['activity'][number];
export type BoardEventModel = BoardChangedSubscription['boardChanged'];
export type BoardMemberModel = BoardMembersQuery['boardMembers'][number];
export type BoardInvitationModel = BoardInvitationsQuery['boardInvitations'][number];

export { BoardEventType };

export interface CardConflict {
  taskId: string;
  localVersion: number;
  remoteVersion: number;
  remoteTask: NonNullable<BoardEventModel['task']>;
}

export interface CardMoveRequest {
  task: BoardCardModel;
  fromListId: string;
  toListId: string;
  toIndex: number;
}

export interface ListMoveRequest {
  list: BoardListModel;
  fromIndex: number;
  toIndex: number;
}
