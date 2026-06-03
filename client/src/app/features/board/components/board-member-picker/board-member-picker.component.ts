import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardMemberModel } from '../../models/board.types';

@Component({
  selector: 'app-board-member-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './board-member-picker.component.html',
  styleUrl: './board-member-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardMemberPickerComponent {
  readonly members = input<BoardMemberModel[]>([]);
  readonly boardId = input<string | null>(null);
  readonly value = input<string | null>(null);
  readonly placeholder = input('Select member');
  readonly valueChange = output<string | null>();

  @ViewChild('menuRoot') private menuRoot?: ElementRef<HTMLElement>;

  readonly menuOpen = signal(false);
  readonly search = signal('');

  readonly assignableMembers = computed(() => {
    const boardId = this.boardId();
    return this.members().filter((member) => !boardId || member.boardId === boardId);
  });

  readonly filteredMembers = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const list = this.assignableMembers();
    if (!keyword) return list;
    return list.filter((member) => {
      const name = (member.displayName ?? '').toLowerCase();
      const email = (member.email ?? '').toLowerCase();
      return name.includes(keyword) || email.includes(keyword) || member.auth0Sub.toLowerCase().includes(keyword);
    });
  });

  readonly selectedMember = computed(() => {
    const current = this.value();
    if (!current) return null;
    return this.assignableMembers().find((member) => member.auth0Sub === current) ?? null;
  });

  toggleMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  selectMember(auth0Sub: string | null, event?: MouseEvent): void {
    event?.stopPropagation();
    this.valueChange.emit(auth0Sub);
    this.menuOpen.set(false);
    this.search.set('');
  }

  keepMenuOpen(event: Event): void {
    event.stopPropagation();
  }

  initials(member: BoardMemberModel): string {
    const value = member.displayName || member.email || 'U';
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  label(member: BoardMemberModel): string {
    return member.displayName || member.email || member.auth0Sub;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) return;
    const target = event.target as Node | null;
    const root = this.menuRoot?.nativeElement;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (!target || !root || (!root.contains(target) && !path.includes(root))) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }
}
