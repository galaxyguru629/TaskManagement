import { Injectable, inject, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, take, tap } from 'rxjs';
import { MeDocument, MeGQL, MeQuery, UpdateMyProfileGQL, type UserProfileFieldsFragment } from '../../../graphql/generated/graphql';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly apollo = inject(Apollo);
  private readonly meGql = inject(MeGQL);
  private readonly updateMyProfileGql = inject(UpdateMyProfileGQL);

  private readonly meState = signal<UserProfileFieldsFragment | null>(null);
  readonly me = this.meState.asReadonly();

  ensureMe() {
    return this.apollo.watchQuery<MeQuery>({ query: MeDocument, fetchPolicy: 'cache-first' }).valueChanges.pipe(
      map(({ data }) => data.me ?? null),
      tap((profile) => this.meState.set(profile)),
      take(1),
    );
  }

  loadMe() {
    return this.meGql.fetch({}, { fetchPolicy: 'cache-first' }).pipe(
      map((result) => result.data.me ?? null),
      tap((profile) => this.meState.set(profile)),
    );
  }

  updateProfile(displayName: string, pictureUrl?: string | null) {
    return this.updateMyProfileGql
      .mutate(
        { input: { displayName, pictureUrl } },
        {
          refetchQueries: [{ query: MeDocument }],
        },
      )
      .pipe(
        map((result) => result.data?.updateMyProfile as UserProfileFieldsFragment),
        tap((profile) => this.meState.set(profile)),
      );
  }

  updateDisplayName(displayName: string) {
    return this.updateProfile(displayName);
  }
}
