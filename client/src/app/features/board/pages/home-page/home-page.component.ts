import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { AcceptInvitationDocument, AcceptInvitationMutation, AcceptInvitationMutationVariables, BoardsDocument, BoardsQuery, DeclineInvitationDocument, DeclineInvitationMutation, DeclineInvitationMutationVariables, MeDocument, MeQuery, MyInvitationsDocument, MyInvitationsQuery } from '../../../../graphql/generated/graphql';

interface BoardWithRole {
  id: string;
  title: string;
  description: string | null;
  background: string;
  logoUrl: string | null;
  createdByAuth0Sub: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);

  readonly showSkeleton = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly ownedBoards = signal<BoardWithRole[]>([]);
  readonly invitedBoards = signal<BoardWithRole[]>([]);
  readonly pendingInvitations = signal<MyInvitationsQuery['myInvitations']>([]);
  readonly skeletonBoards = [1, 2, 3];

  ngOnInit(): void {
    requestAnimationFrame(() => {
      this.showSkeleton.set(true);
      void this.loadHome();
    });
  }

  async loadHome(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const meResult = await firstValueFrom(this.apollo.query<MeQuery>({ query: MeDocument, fetchPolicy: 'cache-first' }));
      const currentUserSub = meResult.data.me?.auth0Sub;
      if (!currentUserSub) {
        this.error.set('Profile is required before using boards.');
        this.loading.set(false);
        return;
      }

      const [boardsResult, invitationsResult] = await Promise.all([
        firstValueFrom(this.apollo.query<BoardsQuery>({ query: BoardsDocument, fetchPolicy: 'network-only' })),
        firstValueFrom(this.apollo.query<MyInvitationsQuery>({ query: MyInvitationsDocument, fetchPolicy: 'network-only' })),
      ]);
      this.pendingInvitations.set(invitationsResult.data.myInvitations ?? []);

      const boards: BoardWithRole[] = (boardsResult.data.boards ?? []).map((board) => ({
        id: board.id,
        title: board.title,
        description: board.description ?? null,
        background: board.background,
        logoUrl: board.logoUrl ?? null,
        createdByAuth0Sub: board.createdByAuth0Sub,
      }));

      this.ownedBoards.set(boards.filter((board) => board.createdByAuth0Sub === currentUserSub));
      this.invitedBoards.set(boards.filter((board) => board.createdByAuth0Sub !== currentUserSub));
    } catch {
      this.error.set('Could not load boards.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToCreateBoard(): Promise<void> {
    await this.router.navigate(['/boards/create']);
  }

  async acceptInvitation(invitationId: string): Promise<void> {
    await firstValueFrom(
      this.apollo.mutate<AcceptInvitationMutation, AcceptInvitationMutationVariables>({
        mutation: AcceptInvitationDocument,
        variables: { id: invitationId },
      }),
    );
    this.showSkeleton.set(true);
    await this.loadHome();
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await firstValueFrom(
      this.apollo.mutate<DeclineInvitationMutation, DeclineInvitationMutationVariables>({
        mutation: DeclineInvitationDocument,
        variables: { id: invitationId },
      }),
    );
    this.showSkeleton.set(true);
    await this.loadHome();
  }

  async openBoard(boardId: string): Promise<void> {
    await this.router.navigate(['/board', boardId]);
  }
}
