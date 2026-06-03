import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Apollo } from 'apollo-angular';
import { map, finalize, firstValueFrom } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import {
  AddCommentDocument,
  BoardChangedDocument,
  BoardChangedSubscription,
  BoardChangedSubscriptionVariables,
  BoardEventType,
  BoardRole,
  BoardInvitationFieldsFragment,
  CreateBoardDocument,
  CreateBoardMutation,
  CreateBoardMutationVariables,
  BoardMembersDocument,
  BoardMembersQuery,
  BoardMembersQueryVariables,
  InviteMemberDocument,
  InviteMemberMutation,
  InviteMemberMutationVariables,
  MeDocument,
  MeQuery,
  AcceptInvitationDocument,
  AcceptInvitationMutation,
  AcceptInvitationMutationVariables,
  DeclineInvitationDocument,
  DeclineInvitationMutation,
  DeclineInvitationMutationVariables,
  BoardInvitationsDocument,
  BoardInvitationsQuery,
  BoardInvitationsQueryVariables,
  BoardViewDocument,
  BoardViewQuery,
  BoardViewQueryVariables,
  CreateChecklistItemDocument,
  CreateChecklistItemMutation,
  CreateChecklistItemMutationVariables,
  CreateListDocument,
  CreateListMutation,
  CreateListMutationVariables,
  CreateTaskDocument,
  CreateTaskMutation,
  CreateTaskMutationVariables,
  DefaultBoardDocument,
  DefaultBoardQuery,
  DeleteChecklistItemDocument,
  DeleteChecklistItemMutation,
  DeleteChecklistItemMutationVariables,
  DeleteTaskDocument,
  DeleteTaskMutation,
  DeleteTaskMutationVariables,
  MoveTaskDocument,
  MoveTaskMutation,
  MoveTaskMutationVariables,
  UpdateChecklistItemDocument,
  UpdateChecklistItemMutation,
  UpdateChecklistItemMutationVariables,
  UpdateListDocument,
  UpdateListMutation,
  UpdateListMutationVariables,
  UpdateTaskDocument,
  UpdateTaskMutation,
  UpdateTaskMutationVariables,
  AddCommentMutation,
  AddCommentMutationVariables,
  ProjectUsersDocument,
  ProjectUsersQuery,
  ProjectUsersQueryVariables,
} from '../../../graphql/generated/graphql';
import { BoardCardModel, BoardListModel, BoardMemberModel, BoardViewModel, CardConflict, CardMoveRequest, ListMoveRequest } from '../models/board.types';
import {
  applyBoardEvent,
  applyChecklistItem,
  applyComment,
  removeChecklistItem,
  replaceChecklistTempId,
  replaceCommentTempId,
  applyListCreated,
  applyListUpdated,
  reconcileCreatedCard,
  reconcileTask,
  mergeBoardView,
} from './board-sync';

type DueDateOption = 'none' | 'overdue' | 'today' | 'week' | 'month';

interface FilterState {
  search: string;
  assigneeIds: string[];
  labelIds: string[];
  dueDateOptions: DueDateOption[];
  priorities: number[];
}

function matchDueDateOptions(
  dueDate: string | null | undefined,
  options: Set<DueDateOption>,
  today: Date,
  weekStart: Date,
  weekEnd: Date,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  if (options.has('none') && !dueDate) return true;
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (options.has('overdue') && due < today) return true;
  if (options.has('today') && due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate())
    return true;
  if (options.has('week') && due >= weekStart && due <= weekEnd) return true;
  if (options.has('month') && due >= monthStart && due <= monthEnd) return true;
  return false;
}

type CardUpdateInput = Partial<Pick<BoardCardModel, 'title' | 'description' | 'priority' | 'assignees' | 'dueDate' | 'coverColor'>>;

function assigneesEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

@Injectable()
export class BoardFacade {
  private readonly apollo = inject(Apollo);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly boardId = signal<string | null>(null);
  readonly view = signal<BoardViewModel | null>(null);
  readonly members = signal<BoardMemberModel[]>([]);
  readonly invitations = signal<BoardInvitationFieldsFragment[]>([]);
  readonly projectUsers = signal<ProjectUsersQuery['projectUsers']>([]);
  readonly currentUserSub = signal<string | null>(null);
  readonly currentUserEmail = signal<string | null>(null);
  readonly selectedCardId = signal<string | null>(null);
  readonly conflicts = signal<CardConflict[]>([]);
  readonly checklistPending = signal(false);
  readonly commentPending = signal(false);

  // Filter state
  readonly filterOpen = signal(false);
  readonly filterSearch = signal('');
  readonly filterAssigneeIds = signal<Set<string>>(new Set());
  readonly filterLabelIds = signal<Set<string>>(new Set());
  readonly filterDueDateOptions = signal<Set<DueDateOption>>(new Set());
  readonly filterPriorities = signal<Set<number>>(new Set());

  readonly board = computed(() => this.view()?.board ?? null);
  readonly lists = computed(() => this.view()?.lists ?? []);

  readonly filterActiveCount = computed(() => {
    let n = 0;
    if (this.filterSearch()) n++;
    n += this.filterAssigneeIds().size;
    n += this.filterLabelIds().size;
    n += this.filterDueDateOptions().size;
    n += this.filterPriorities().size;
    return n;
  });

  readonly filteredCardCount = computed(() =>
    this.filteredLists().reduce((sum, list) => sum + list.cards.length, 0),
  );

  readonly filteredLists = computed(() => {
    const lists = this.lists();
    const search = this.filterSearch().toLowerCase().trim();
    const assigneeIds = this.filterAssigneeIds();
    const labelIds = this.filterLabelIds();
    const dueDateOptions = this.filterDueDateOptions();
    const priorities = this.filterPriorities();

    if (!search && !assigneeIds.size && !labelIds.size && !dueDateOptions.size && !priorities.size) {
      return lists;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return lists.map((list) => ({
      ...list,
      cards: list.cards.filter((card) => {
        if (search && !card.title.toLowerCase().includes(search) && !(card.description ?? '').toLowerCase().includes(search))
          return false;
        if (assigneeIds.size && !card.assignees.some((a) => assigneeIds.has(a)))
          return false;
        if (labelIds.size && !card.labels.some((l) => labelIds.has(l.id)))
          return false;
        if (dueDateOptions.size && !matchDueDateOptions(card.dueDate, dueDateOptions, today, weekStart, weekEnd, monthStart, monthEnd))
          return false;
        if (priorities.size && !priorities.has(card.priority))
          return false;
        return true;
      }),
    }));
  });

  private readonly persistFilters = effect(() => {
    const boardId = this.boardId();
    if (!boardId) return;
    const state: FilterState = {
      search: this.filterSearch(),
      assigneeIds: [...this.filterAssigneeIds()],
      labelIds: [...this.filterLabelIds()],
      dueDateOptions: [...this.filterDueDateOptions()],
      priorities: [...this.filterPriorities()],
    };
    localStorage.setItem(`taskboard_filter_${boardId}`, JSON.stringify(state));
  });
  readonly selectedCard = computed(() => {
    const id = this.selectedCardId();
    if (!id) return null;
    return this.lists().flatMap((list) => list.cards).find((card) => card.id === id) ?? null;
  });
  readonly userRole = computed(() => {
    const sub = this.currentUserSub();
    if (!sub) return null;
    return this.members().find((member) => member.auth0Sub === sub)?.role ?? null;
  });
  readonly canInvite = computed(() => {
    const role = this.userRole();
    return role === BoardRole.Owner || role === BoardRole.Admin;
  });
  readonly inviteContacts = computed(() => {
    const currentEmail = this.currentUserEmail()?.toLowerCase() ?? '';
    const contacts = new Map<string, { email: string; label: string; displayName: string | null; pictureUrl: string | null }>();
    for (const user of this.projectUsers()) {
      const email = user.email?.trim();
      if (!email || email.toLowerCase() === currentEmail) continue;
      const displayName = user.displayName?.trim() || null;
      const label = displayName ? `${displayName} (${email})` : email;
      contacts.set(email.toLowerCase(), { email, label, displayName, pictureUrl: user.pictureUrl ?? null });
    }
    for (const invitation of this.invitations()) {
      const email = invitation.email?.trim();
      if (!email || email.toLowerCase() === currentEmail) continue;
      if (!contacts.has(email.toLowerCase())) {
        contacts.set(email.toLowerCase(), { email, label: email, displayName: null, pictureUrl: null });
      }
    }
    return [...contacts.values()].sort((a, b) => a.label.localeCompare(b.label));
  });

  private subscriptionStartedFor: string | null = null;
  private readonly pendingMutationIds = new Set<string>();
  private readonly pendingTaskIds = new Set<string>();

  init(boardId?: string | null): void {
    this.loadCurrentUser();
    if (boardId) {
      this.openBoard(boardId);
      return;
    }
    this.apollo
      .query<DefaultBoardQuery>({ query: DefaultBoardDocument, fetchPolicy: 'network-only' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          const id = data.defaultBoard?.id;
          if (!id) {
            this.loading.set(false);
            this.toast.error('No board is available.');
            return;
          }
          this.openBoard(id);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Unable to load the board.');
        },
      });
  }

  openBoard(boardId: string): void {
    if (this.boardId() !== boardId) {
      this.subscriptionStartedFor = null;
    }
    this.boardId.set(boardId);
    this.loadFilterState(boardId);
    this.loadBoard(boardId);
    this.loadMembers(boardId);
    this.loadProjectUsers(boardId);
    this.startSubscription(boardId);
  }

  private loadFilterState(boardId: string): void {
    try {
      const raw = localStorage.getItem(`taskboard_filter_${boardId}`);
      if (!raw) return;
      const state: FilterState = JSON.parse(raw);
      this.filterSearch.set(state.search ?? '');
      this.filterAssigneeIds.set(new Set(state.assigneeIds ?? []));
      this.filterLabelIds.set(new Set(state.labelIds ?? []));
      this.filterDueDateOptions.set(new Set(state.dueDateOptions ?? []));
      this.filterPriorities.set(new Set(state.priorities ?? []));
    } catch {
      /* ignore corrupt state */
    }
  }

  createBoard(title: string, description?: string | null, logoImageData?: string | null): Promise<string | null> {
    const cleaned = title.trim();
    if (!cleaned) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.apollo
        .mutate<CreateBoardMutation, CreateBoardMutationVariables>({
          mutation: CreateBoardDocument,
          variables: { input: { title: cleaned, description: description?.trim() || null, logoImageData: logoImageData ?? null } },
        })
        .subscribe({
          next: ({ data }) => resolve(data?.createBoard?.id ?? null),
          error: () => {
            this.toast.error('Board creation failed.');
            resolve(null);
          },
        });
    });
  }

  inviteMember(email: string, role: BoardRole): void {
    const boardId = this.boardId();
    const cleaned = email.trim();
    if (!boardId || !cleaned || !this.canInvite()) return;
    this.apollo
      .mutate<InviteMemberMutation, InviteMemberMutationVariables>({
        mutation: InviteMemberDocument,
        variables: { input: { boardId, email: cleaned, role } },
      })
      .subscribe({
        next: () => {
          this.toast.success('Invitation sent.');
          this.loadInvitations(boardId);
        },
        error: () => this.toast.error('Failed to send invitation.'),
      });
  }

  acceptInvitation(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.apollo
        .mutate<AcceptInvitationMutation, AcceptInvitationMutationVariables>({
          mutation: AcceptInvitationDocument,
          variables: { id },
        })
        .subscribe({
          next: () => resolve(true),
          error: () => {
            this.toast.error('Could not accept invitation.');
            resolve(false);
          },
        });
    });
  }

  declineInvitation(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.apollo
        .mutate<DeclineInvitationMutation, DeclineInvitationMutationVariables>({
          mutation: DeclineInvitationDocument,
          variables: { id },
        })
        .subscribe({
          next: () => resolve(true),
          error: () => {
            this.toast.error('Could not decline invitation.');
            resolve(false);
          },
        });
    });
  }

  createList(title: string): void {
    const boardId = this.boardId();
    if (!boardId || !title.trim()) return;
    const snapshot = this.view();
    this.apollo
      .mutate<CreateListMutation, CreateListMutationVariables>({ mutation: CreateListDocument, variables: { input: { boardId, title: title.trim() } } })
      .subscribe({
        next: ({ data }) => {
          const list = data?.createList;
          const view = this.view();
          if (list && view) {
            this.view.set(applyListCreated(view, list));
          }
        },
        error: () => this.rollback(snapshot, 'List creation failed.'),
      });
  }

  createCard(list: BoardListModel, title: string): void {
    const cleaned = title.trim();
    if (!cleaned) return;
    const snapshot = this.view();
    const optimistic = this.addLocalCard(snapshot, list, cleaned);
    if (optimistic) this.view.set(optimistic);
    const clientMutationId = this.trackMutation();

    this.apollo
      .mutate<CreateTaskMutation, CreateTaskMutationVariables>({
        mutation: CreateTaskDocument,
        variables: {
          input: {
            boardId: list.boardId,
            listId: list.id,
            title: cleaned,
            priority: 2,
            clientMutationId,
          },
        },
      })
      .pipe(finalize(() => this.clearPendingMutation(clientMutationId)))
      .subscribe({
        next: ({ data }) => {
          const task = data?.createTask;
          if (task) {
            this.reconcileCreatedCardFromServer(task);
          }
        },
        error: () => this.rollback(snapshot, 'Card creation failed.'),
      });
  }

  updateCard(card: BoardCardModel, input: CardUpdateInput): void {
    const changed = this.changedCardInput(card, input);
    if (!Object.keys(changed).length) return;

    const snapshot = this.view();
    const clientMutationId = this.trackMutation(card.id);
    this.patchLocalCard(card.id, { ...card, ...changed, version: card.version + 1, updatedAt: new Date().toISOString() });
    this.apollo
      .mutate<UpdateTaskMutation, UpdateTaskMutationVariables>({
        mutation: UpdateTaskDocument,
        variables: { id: card.id, expectedVersion: card.version, input: { ...changed, clientMutationId } },
      })
      .pipe(finalize(() => this.clearPendingMutation(clientMutationId, card.id)))
      .subscribe({
        next: ({ data }) => {
          if (data?.updateTask.conflict && data.updateTask.task) {
            this.registerConflict(card.id, card.version, data.updateTask.task);
            this.toast.warning('This card changed elsewhere.', `conflict:${card.id}`);
            this.reconcileServerTask(data.updateTask.task);
          } else {
            this.dismissConflict(card.id);
            if (data?.updateTask.task) this.reconcileServerTask(data.updateTask.task);
          }
        },
        error: () => this.rollback(snapshot, 'Card update failed.'),
      });
  }

  moveCard(request: CardMoveRequest): void {
    const snapshot = this.view();
    const position = this.positionForMove(snapshot, request);
    const clientMutationId = this.trackMutation(request.task.id);
    const moved = this.moveLocalCard(snapshot, request, position);
    if (moved) this.view.set(moved);

    this.apollo
      .mutate<MoveTaskMutation, MoveTaskMutationVariables>({
        mutation: MoveTaskDocument,
        variables: {
          input: {
            boardId: request.task.boardId,
            taskId: request.task.id,
            toListId: request.toListId,
            position,
            expectedVersion: request.task.version,
            clientMutationId,
          },
        },
      })
      .pipe(finalize(() => this.clearPendingMutation(clientMutationId, request.task.id)))
      .subscribe({
        next: ({ data }) => {
          if (data?.moveTask.conflict && data.moveTask.task) {
            this.registerConflict(request.task.id, request.task.version, data.moveTask.task);
            this.toast.warning('Move conflict detected.', `conflict:${request.task.id}`);
            this.reconcileServerTask(data.moveTask.task);
          } else {
            this.dismissConflict(request.task.id);
            if (data?.moveTask.task) this.reconcileServerTask(data.moveTask.task);
          }
        },
        error: () => this.rollback(snapshot, 'Move failed.'),
      });
  }

  reorderList(request: ListMoveRequest): void {
    if (request.fromIndex === request.toIndex) return;
    const snapshot = this.view();
    const position = this.positionForListMove(snapshot, request);
    const clientMutationId = this.trackMutation();
    const moved = this.moveLocalList(snapshot, request, position);
    if (moved) this.view.set(moved);

    this.apollo
      .mutate<UpdateListMutation, UpdateListMutationVariables>({
        mutation: UpdateListDocument,
        variables: {
          id: request.list.id,
          expectedVersion: request.list.version,
          input: { position, clientMutationId },
        },
      })
      .pipe(finalize(() => this.clearPendingMutation(clientMutationId)))
      .subscribe({
        next: ({ data }) => {
          if (data?.updateList.conflict) {
            this.toast.warning('List order changed elsewhere.', `conflict:list:${request.list.id}`);
            if (data.updateList.list) this.reconcileServerList(data.updateList.list);
          } else if (data?.updateList.list) {
            this.reconcileServerList(data.updateList.list);
          }
        },
        error: () => this.rollback(snapshot, 'List move failed.', `rollback:list:${request.list.id}`),
      });
  }

  archiveCard(card: BoardCardModel): void {
    const snapshot = this.view();
    this.removeLocalCard(card.id);
    this.apollo
      .mutate<DeleteTaskMutation, DeleteTaskMutationVariables>({ mutation: DeleteTaskDocument, variables: { id: card.id, expectedVersion: card.version } })
      .subscribe({
        error: () => this.rollback(snapshot, 'Archive failed.'),
      });
  }

  addChecklistItem(card: BoardCardModel, text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.checklistPending()) return;

    const snapshot = this.view();
    const tempId = `temp-checklist-${crypto.randomUUID()}`;
    const maxPosition = card.checklist.reduce((max, item) => Math.max(max, item.position), 0);
    const optimistic = {
      __typename: 'ChecklistItem' as const,
      id: tempId,
      taskId: card.id,
      text: trimmed,
      checked: false,
      position: maxPosition + 1024,
    };

    const clientMutationId = this.trackMutation(card.id);
    const view = this.view();
    if (view) this.view.set(applyChecklistItem(view, optimistic));
    this.checklistPending.set(true);

    this.apollo
      .mutate<CreateChecklistItemMutation, CreateChecklistItemMutationVariables>({
        mutation: CreateChecklistItemDocument,
        variables: { taskId: card.id, text: trimmed, clientMutationId },
      })
      .pipe(finalize(() => this.clearPendingMutation(clientMutationId, card.id)))
      .subscribe({
        next: ({ data }) => {
          const item = data?.createChecklistItem;
          const current = this.view();
          if (item && current) {
            this.view.set(replaceChecklistTempId(current, card.id, tempId, item));
          }
          this.checklistPending.set(false);
        },
        error: () => {
          if (snapshot) this.view.set(snapshot);
          this.checklistPending.set(false);
          this.toast.error('Checklist update failed.');
        },
      });
  }

  updateChecklistItem(card: BoardCardModel, id: string, checked: boolean): void {
    const view = this.view();
    if (!view) return;

    const existing = this.findChecklistItem(view, card.id, id);
    if (!existing || id.startsWith('temp-checklist-')) return;

    this.view.set(applyChecklistItem(view, { ...existing, checked }));

    this.apollo
      .mutate<UpdateChecklistItemMutation, UpdateChecklistItemMutationVariables>({ mutation: UpdateChecklistItemDocument, variables: { id, checked } })
      .subscribe({
        next: ({ data }) => {
          const item = data?.updateChecklistItem;
          const current = this.view();
          if (item && current) this.view.set(applyChecklistItem(current, item));
        },
        error: () => {
          const current = this.view();
          if (current) this.view.set(applyChecklistItem(current, { ...existing, checked: existing.checked }));
          this.toast.error('Checklist update failed.');
        },
      });
  }

  renameChecklistItem(card: BoardCardModel, id: string, text: string): void {
    const trimmed = text.trim();
    const view = this.view();
    if (!view || !trimmed) return;

    const existing = this.findChecklistItem(view, card.id, id);
    if (!existing || id.startsWith('temp-checklist-') || existing.text === trimmed) return;

    this.view.set(applyChecklistItem(view, { ...existing, text: trimmed }));

    this.apollo
      .mutate<UpdateChecklistItemMutation, UpdateChecklistItemMutationVariables>({
        mutation: UpdateChecklistItemDocument,
        variables: { id, text: trimmed },
      })
      .subscribe({
        next: ({ data }) => {
          const item = data?.updateChecklistItem;
          const current = this.view();
          if (item && current) this.view.set(applyChecklistItem(current, item));
        },
        error: () => {
          const current = this.view();
          if (current) this.view.set(applyChecklistItem(current, existing));
          this.toast.error('Checklist update failed.');
        },
      });
  }

  deleteChecklistItem(card: BoardCardModel, id: string): void {
    const view = this.view();
    if (!view) return;

    const existing = this.findChecklistItem(view, card.id, id);
    if (!existing || id.startsWith('temp-checklist-')) return;

    this.view.set(removeChecklistItem(view, card.id, id));

    this.apollo
      .mutate<DeleteChecklistItemMutation, DeleteChecklistItemMutationVariables>({
        mutation: DeleteChecklistItemDocument,
        variables: { id },
      })
      .subscribe({
        error: () => {
          const current = this.view();
          if (current) this.view.set(applyChecklistItem(current, existing));
          this.toast.error('Checklist delete failed.');
        },
      });
  }

  addComment(card: BoardCardModel, body: string): void {
    const trimmed = body.trim();
    if (!trimmed || this.commentPending()) return;

    const snapshot = this.view();
    const tempId = `temp-comment-${crypto.randomUUID()}`;
    const optimistic = {
      __typename: 'TaskComment' as const,
      id: tempId,
      taskId: card.id,
      body: trimmed,
      author: 'You',
      createdAt: new Date().toISOString(),
    };

    const view = this.view();
    if (view) this.view.set(applyComment(view, optimistic));
    this.commentPending.set(true);

    this.apollo
      .mutate<AddCommentMutation, AddCommentMutationVariables>({ mutation: AddCommentDocument, variables: { taskId: card.id, body: trimmed } })
      .subscribe({
        next: ({ data }) => {
          const comment = data?.addComment;
          const current = this.view();
          if (comment && current) {
            this.view.set(replaceCommentTempId(current, card.id, tempId, comment));
          }
          this.commentPending.set(false);
        },
        error: () => {
          if (snapshot) this.view.set(snapshot);
          this.commentPending.set(false);
          this.toast.error('Comment failed.');
        },
      });
  }

  selectCard(id: string | null): void {
    this.selectedCardId.set(id);
  }

  toggleFilterPanel(): void {
    this.filterOpen.update((v) => !v);
  }

  setFilterSearch(value: string): void {
    this.filterSearch.set(value);
  }

  toggleFilterAssignee(id: string): void {
    this.filterAssigneeIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleFilterLabel(id: string): void {
    this.filterLabelIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleFilterDueDate(option: DueDateOption): void {
    this.filterDueDateOptions.update((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  toggleFilterPriority(priority: number): void {
    this.filterPriorities.update((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  }

  clearFilters(): void {
    this.filterSearch.set('');
    this.filterAssigneeIds.set(new Set());
    this.filterLabelIds.set(new Set());
    this.filterDueDateOptions.set(new Set());
    this.filterPriorities.set(new Set());
  }

  dismissConflict(taskId: string): void {
    this.conflicts.update((items) => items.filter((item) => item.taskId !== taskId));
  }

  private loadBoard(boardId: string): void {
    this.loading.set(true);
    void firstValueFrom(
      this.apollo.query<BoardViewQuery, BoardViewQueryVariables>({
        query: BoardViewDocument,
        variables: { boardId },
        fetchPolicy: 'network-only',
      }),
    )
      .then(({ data }) => {
        if (this.boardId() !== boardId) return;
        if (data.boardView) {
          this.view.set(data.boardView);
        }
        this.loading.set(false);
      })
      .catch(() => {
        if (this.boardId() !== boardId) return;
        this.loading.set(false);
        this.toast.error('Board refresh failed.');
      });
  }

  private loadMembers(boardId: string): void {
    this.apollo
      .query<BoardMembersQuery, BoardMembersQueryVariables>({
        query: BoardMembersDocument,
        variables: { boardId },
        fetchPolicy: 'network-only',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.members.set(data.boardMembers ?? []);
          if (this.canInvite()) this.loadInvitations(boardId);
        },
        error: () => {
          this.toast.warning('Could not load board members.', 'members:load');
        },
      });
  }

  private loadProjectUsers(boardId: string): void {
    this.apollo
      .query<ProjectUsersQuery, ProjectUsersQueryVariables>({
        query: ProjectUsersDocument,
        variables: { boardId },
        fetchPolicy: 'network-only',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => this.projectUsers.set(data.projectUsers ?? []),
        error: () => this.projectUsers.set([]),
      });
  }

  private loadInvitations(boardId: string): void {
    this.apollo
      .query<BoardInvitationsQuery, BoardInvitationsQueryVariables>({
        query: BoardInvitationsDocument,
        variables: { boardId },
        fetchPolicy: 'network-only',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.invitations.set(data.boardInvitations ?? []);
        },
        error: () => {
          this.invitations.set([]);
        },
      });
  }

  private loadCurrentUser(): void {
    this.apollo
      .query<MeQuery>({ query: MeDocument, fetchPolicy: 'network-only' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.currentUserSub.set(data.me?.auth0Sub ?? null);
          this.currentUserEmail.set(data.me?.email ?? null);
          const boardId = this.boardId();
          if (boardId && this.canInvite()) this.loadInvitations(boardId);
        },
        error: () => {
          this.currentUserSub.set(null);
          this.currentUserEmail.set(null);
        },
      });
  }

  private startSubscription(boardId: string): void {
    if (this.subscriptionStartedFor === boardId) return;
    this.subscriptionStartedFor = boardId;
    this.apollo
      .subscribe<BoardChangedSubscription, BoardChangedSubscriptionVariables>({
        query: BoardChangedDocument,
        variables: { boardId },
      })
      .pipe(
        map((result) => result.data?.boardChanged),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          if (!event) return;
          if (event.type === BoardEventType.BoardUpdated) {
            const id = this.boardId();
            if (id) {
              this.loadMembers(id);
              if (this.canInvite()) this.loadInvitations(id);
            }
          }
          const taskId = event.task?.id ?? null;
          if (
            (event.type === BoardEventType.ChecklistUpdated || event.type === BoardEventType.ChecklistItemDeleted) &&
            event.checklistItem &&
            event.actorId &&
            event.actorId === this.currentUserSub()
          ) {
            return;
          }
          if (event.clientMutationId && this.pendingMutationIds.has(event.clientMutationId)) {
            return;
          }
          if (taskId && this.pendingTaskIds.has(taskId) && this.isCardSnapshotEvent(event.type)) {
            return;
          }
          const view = this.view();
          if (view) {
            const updated = applyBoardEvent(view, event);
            if (updated) this.view.set(updated);
          }
          const selected = this.selectedCard();
          if (selected && event.task?.id === selected.id && event.task.version > selected.version) {
            this.registerConflict(selected.id, selected.version, event.task);
          }
        },
        error: () => {
          this.toast.warning('Live updates disconnected.', 'subscription:board');
          this.refetchBoard();
        },
      });
  }

  private refetchBoard(): void {
    const boardId = this.boardId();
    if (!boardId) return;
    if (this.pendingMutationIds.size > 0) return;

    void firstValueFrom(
      this.apollo.query<BoardViewQuery, BoardViewQueryVariables>({
        query: BoardViewDocument,
        variables: { boardId },
        fetchPolicy: 'network-only',
      }),
    )
      .then(({ data }) => {
        if (this.boardId() !== boardId || !data.boardView) return;
        const current = this.view();
        if (current) {
          this.view.set(mergeBoardView(current, data.boardView));
        } else {
          this.view.set(data.boardView);
        }
      })
      .catch(() => {
        this.toast.warning('Could not refresh board.', 'refetch:board');
      });
  }

  private rollback(snapshot: BoardViewModel | null, message: string, key?: string): void {
    if (snapshot) this.view.set(snapshot);
    this.refetchBoard();
    this.toast.error(`${message} Changes reverted.`, key ?? `rollback:${message}`);
  }

  private reconcileCreatedCardFromServer(task: NonNullable<CreateTaskMutation['createTask']>): void {
    const view = this.view();
    if (!view) return;
    let tempId: string | null = null;
    for (const list of view.lists) {
      for (const card of list.cards) {
        if (card.id.startsWith('temp-') && list.id === task.listId) {
          tempId = card.id;
          break;
        }
      }
      if (tempId) break;
    }
    this.view.set(reconcileCreatedCard(view, task));
    if (tempId && this.selectedCardId() === tempId) {
      this.selectedCardId.set(task.id);
    }
  }

  private reconcileServerTask(task: NonNullable<UpdateTaskMutation['updateTask']['task']>): void {
    const view = this.view();
    if (!view) return;
    this.view.set(reconcileTask(view, task));
  }

  private reconcileServerList(list: NonNullable<UpdateListMutation['updateList']['list']>): void {
    const view = this.view();
    if (!view) return;
    this.view.set(applyListUpdated(view, list));
  }

  private registerConflict(taskId: string, localVersion: number, remoteTask: CardConflict['remoteTask']): void {
    this.conflicts.update((items) => [
      ...items.filter((item) => item.taskId !== taskId),
      { taskId, localVersion, remoteVersion: remoteTask.version, remoteTask },
    ]);
  }

  private findChecklistItem(view: BoardViewModel, cardId: string, itemId: string) {
    const card = view.lists.flatMap((list) => list.cards).find((candidate) => candidate.id === cardId);
    return card?.checklist.find((item) => item.id === itemId);
  }

  private trackMutation(taskId?: string): string {
    const id = crypto.randomUUID();
    this.pendingMutationIds.add(id);
    if (taskId) this.pendingTaskIds.add(taskId);
    return id;
  }

  private clearPendingMutation(clientMutationId: string, taskId?: string): void {
    this.pendingMutationIds.delete(clientMutationId);
    if (taskId) this.pendingTaskIds.delete(taskId);
  }

  private isCardSnapshotEvent(type: BoardEventType): boolean {
    return (
      type === BoardEventType.CardCreated ||
      type === BoardEventType.CardUpdated ||
      type === BoardEventType.CardMoved ||
      type === BoardEventType.CardArchived ||
      type === BoardEventType.CardDeleted
    );
  }

  private changedCardInput(card: BoardCardModel, input: CardUpdateInput): CardUpdateInput {
    const changed: CardUpdateInput = {};
    if (input.title !== undefined && input.title !== card.title) changed.title = input.title;
    if (input.description !== undefined && input.description !== card.description) changed.description = input.description;
    if (input.priority !== undefined && Number(input.priority) !== card.priority) changed.priority = Number(input.priority);
    if (input.assignees !== undefined && !assigneesEqual(input.assignees, card.assignees)) {
      changed.assignees = input.assignees;
    }
    if (input.dueDate !== undefined && input.dueDate !== card.dueDate) changed.dueDate = input.dueDate;
    if (input.coverColor !== undefined && input.coverColor !== card.coverColor) changed.coverColor = input.coverColor;
    return changed;
  }

  private patchLocalCard(id: string, card: BoardCardModel): void {
    const view = this.view();
    if (!view) return;
    this.view.set({
      ...view,
      lists: view.lists.map((list) => ({
        ...list,
        cards: list.cards.map((existing) => (existing.id === id ? { ...existing, ...card } : existing)),
      })),
    });
  }

  private removeLocalCard(id: string): void {
    const view = this.view();
    if (!view) return;
    this.view.set({
      ...view,
      lists: view.lists.map((list) => ({ ...list, cards: list.cards.filter((card) => card.id !== id) })),
    });
  }

  private addLocalCard(view: BoardViewModel | null, list: BoardListModel, title: string): BoardViewModel | null {
    if (!view) return null;
    const now = new Date().toISOString();
    const card = {
      __typename: 'BoardCard' as const,
      id: `temp-${crypto.randomUUID()}`,
      boardId: list.boardId,
      listId: list.id,
      title,
      description: null,
      priority: 2,
      assignees: [],
      position: 0,
      dueDate: null,
      coverColor: null,
      archived: false,
      version: 0,
      updatedAt: now,
      labels: [],
      checklist: [],
      comments: [],
    };
    return {
      ...view,
      lists: view.lists.map((candidate) =>
        candidate.id === list.id ? { ...candidate, cards: [...candidate.cards, card] } : candidate,
      ),
    };
  }

  private moveLocalCard(view: BoardViewModel | null, request: CardMoveRequest, position: number): BoardViewModel | null {
    if (!view) return null;
    const movedCard = {
      ...request.task,
      listId: request.toListId,
      position,
      version: request.task.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...view,
      lists: view.lists.map((list) => {
        const without = list.cards.filter((card) => card.id !== request.task.id);
        if (list.id !== request.toListId) return { ...list, cards: without };
        const cards = [...without];
        cards.splice(request.toIndex, 0, movedCard);
        return { ...list, cards };
      }),
    };
  }

  private positionForMove(view: BoardViewModel | null, request: CardMoveRequest): number {
    const cards = (view?.lists.find((list) => list.id === request.toListId)?.cards ?? []).filter((card) => card.id !== request.task.id);
    const before = cards[request.toIndex - 1]?.position ?? 0;
    const after = cards[request.toIndex]?.position ?? before + 2048;
    return (before + after) / 2;
  }

  private moveLocalList(view: BoardViewModel | null, request: ListMoveRequest, position: number): BoardViewModel | null {
    if (!view) return null;
    const lists = view.lists.filter((list) => list.id !== request.list.id);
    lists.splice(request.toIndex, 0, { ...request.list, position, version: request.list.version + 1 });
    return { ...view, lists };
  }

  private positionForListMove(view: BoardViewModel | null, request: ListMoveRequest): number {
    const lists = (view?.lists ?? []).filter((list) => list.id !== request.list.id);
    const before = lists[request.toIndex - 1]?.position ?? 0;
    const after = lists[request.toIndex]?.position ?? before + 2048;
    return (before + after) / 2;
  }
}
