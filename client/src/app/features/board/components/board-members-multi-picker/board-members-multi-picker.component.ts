import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardMemberModel } from '../../models/board.types';
import { memberInitials } from '../../utils/board.utils';

@Component({
  selector: 'app-board-members-multi-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './board-members-multi-picker.component.html',
  styleUrl: './board-members-multi-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardMembersMultiPickerComponent {
  readonly members = input<BoardMemberModel[]>([]);
  readonly boardId = input<string | null>(null);
  readonly values = input<string[]>([]);
  readonly valuesChange = output<string[]>();

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

  readonly selectedMembers = computed(() => {
    const selected = new Set(this.values());
    return this.assignableMembers().filter((member) => selected.has(member.auth0Sub));
  });

  toggleMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  isSelected(auth0Sub: string): boolean {
    return this.values().includes(auth0Sub);
  }

  toggleMember(auth0Sub: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const current = this.values();
    const next = current.includes(auth0Sub) ? current.filter((id) => id !== auth0Sub) : [...current, auth0Sub];
    this.valuesChange.emit(next);
  }

  keepMenuOpen(event: Event): void {
    event.stopPropagation();
  }

  initials = memberInitials;

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
      this.search.set('');
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
    this.search.set('');
  }
}
