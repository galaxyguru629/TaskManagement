import { Pipe, PipeTransform } from '@angular/core';
import { BoardMemberModel } from '../models/board.types';

@Pipe({ name: 'memberInitials', standalone: true })
export class MemberInitialsPipe implements PipeTransform {
  transform(member: BoardMemberModel | { displayName: string | null; email: string | null } | null): string {
    if (!member) return 'U';
    const value = member.displayName || member.email || 'U';
    return this.initials(value, 2);
  }

  transformSingle(member: BoardMemberModel | { displayName: string | null; email: string | null } | null): string {
    if (!member) return 'U';
    const value = member.displayName || member.email || 'U';
    return value.slice(0, 1).toUpperCase();
  }

  fromString(value: string, maxParts = 2): string {
    return this.initials(value || 'U', maxParts);
  }

  private initials(value: string, maxParts: number): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, maxParts)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
