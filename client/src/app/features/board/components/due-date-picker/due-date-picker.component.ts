import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';

export type DueDateStatus = 'overdue' | 'soon' | null;

@Component({
  selector: 'app-due-date-picker',
  standalone: true,
  templateUrl: './due-date-picker.component.html',
  styleUrl: './due-date-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DueDatePickerComponent implements AfterViewInit, OnDestroy {
  readonly value = input('');
  readonly valueChange = output<string>();
  readonly cleared = output<void>();

  @ViewChild('inputEl') private inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerBtn') private triggerBtn?: ElementRef<HTMLButtonElement>;

  private picker: FlatpickrInstance | null = null;

  readonly displayLabel = computed(() => {
    const raw = this.value();
    if (!raw) return null;
    const date = this.parseDate(raw);
    if (!date) return raw;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  });

  readonly dueStatus = computed((): DueDateStatus => {
    const raw = this.value();
    if (!raw) return null;
    const due = this.parseDate(raw);
    if (!due) return null;

    const today = this.startOfDay(new Date());
    const dueDay = this.startOfDay(due);
    if (dueDay.getTime() < today.getTime()) return 'overdue';

    const daysUntil = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
    if (daysUntil <= 2) return 'soon';
    return null;
  });

  readonly statusLabel = computed(() => {
    const status = this.dueStatus();
    if (status === 'overdue') return 'Overdue';
    if (status === 'soon') return 'Due soon';
    return null;
  });

  constructor() {
    effect(() => {
      const next = this.value();
      if (this.picker && this.picker.input.value !== next) {
        if (next) {
          this.picker.setDate(next, false);
        } else {
          this.picker.clear();
        }
      }
    });
  }

  ngAfterViewInit(): void {
    const input = this.inputEl?.nativeElement;
    if (!input) return;

    this.picker = flatpickr(input, {
      dateFormat: 'Y-m-d',
      allowInput: false,
      disableMobile: true,
      defaultDate: this.value() || undefined,
      onChange: (_dates, dateStr) => {
        this.valueChange.emit(dateStr);
      },
      onOpen: () => {
        queueMicrotask(() => {
          input.blur();
          const calendar = this.picker?.calendarContainer;
          if (!calendar) return;
          calendar.setAttribute('tabindex', '-1');
          calendar.focus();
        });
      },
      onClose: () => {
        this.triggerBtn?.nativeElement.focus();
      },
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
    this.picker = null;
  }

  openPicker(): void {
    this.picker?.open();
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    this.picker?.clear();
    this.valueChange.emit('');
    this.cleared.emit();
  }

  private parseDate(raw: string): Date | null {
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
