import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardRole } from '../../../../graphql/generated/graphql';
import { BoardInvitationModel, BoardMemberModel, BoardModel } from '../../models/board.types';
import { memberInitials } from '../../utils/board.utils';

@Component({
  selector: 'app-board-header',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './board-header.component.html',
  styleUrl: './board-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardHeaderComponent {
  readonly inviteContacts = input<Array<{ email: string; label: string; displayName: string | null; pictureUrl: string | null }>>([]);
  readonly board = input<BoardModel | null>(null);
  readonly members = input<BoardMemberModel[]>([]);
  readonly invitations = input<BoardInvitationModel[]>([]);
  readonly canInvite = input(false);
  readonly loading = input(false);
  readonly inviteMember = output<{ email: string; role: BoardRole }>();
  readonly roles = [BoardRole.Member, BoardRole.Admin];
  @ViewChild('inviteMenuRoot') private inviteMenuRoot?: ElementRef<HTMLElement>;

  inviteEmail = '';
  inviteRole = BoardRole.Member;
  inviteMenuOpen = false;
  inviteSearch = '';

  initials = memberInitials;

  sendInvite(): void {
    if (!this.inviteEmail.trim()) return;
    this.inviteMember.emit({ email: this.inviteEmail.trim(), role: this.inviteRole });
    this.inviteEmail = '';
    this.inviteRole = BoardRole.Member;
    this.inviteSearch = '';
    this.inviteMenuOpen = false;
  }

  toggleInviteMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.inviteMenuOpen = !this.inviteMenuOpen;
  }

  selectInviteContact(email: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.inviteEmail = email;
    this.inviteMenuOpen = false;
  }

  keepInviteMenuOpen(event: Event): void {
    event.stopPropagation();
  }

  filteredContacts() {
    const keyword = this.inviteSearch.trim().toLowerCase();
    if (!keyword) return this.inviteContacts();
    return this.inviteContacts().filter(
      (contact) =>
        contact.label.toLowerCase().includes(keyword) ||
        contact.email.toLowerCase().includes(keyword) ||
        (contact.displayName ?? '').toLowerCase().includes(keyword),
    );
  }

  selectedInviteContact() {
    return this.inviteContacts().find((contact) => contact.email === this.inviteEmail) ?? null;
  }

  avatarInitials: (contact: { email: string; displayName: string | null }) => string = (contact) => {
    const source = contact.displayName?.trim() || contact.email;
    return memberInitials(source ? { displayName: source, email: null } : null);
  };

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.inviteMenuOpen) return;
    const target = event.target as Node | null;
    const menuRoot = this.inviteMenuRoot?.nativeElement;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (!target || !menuRoot || (!menuRoot.contains(target) && !path.includes(menuRoot))) {
      this.inviteMenuOpen = false;
    }
  }
}
