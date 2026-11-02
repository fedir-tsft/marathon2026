import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Observable, Subscription, catchError, exhaustMap, finalize, forkJoin, map, tap, timer } from 'rxjs';
import { Participant } from '@app/models/group-orders/participant.model';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '@app/models/group-orders/group-status.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { ParticipantCardComponent } from '@app/components/group-orders/participant-card/participant-card.component';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';

const SYNC_INTERVAL_MS = 15_000;

interface GroupScreenData {
  sessions: GroupSessionsResponse;
  ownerSessionId: string;
  status: GroupStatusResponse;
}

@Component({
  selector: 'app-group-order-page',
  imports: [CurrencyPipe, DatePipe, ParticipantCardComponent, ModalComponent],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class GroupOrderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly participants = signal<Participant[]>([]);
  readonly invite = signal<GuestInvite | null>(null);
  readonly ownerSessionId = signal<string | null>(null);
  readonly groupStatus = signal<GroupStatusResponse | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isRefreshing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly refreshFailed = signal(false);
  readonly isSubmitDialogOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly selectedGuest = signal<Participant | null>(null);
  readonly isRemovingGuest = signal(false);

  readonly consolidatedOrder = computed(() => consolidatePreOrder(this.participants()));
  readonly pendingParticipants = computed(() =>
    this.participants().filter((participant) => !participant.isSubmitted)
  );
  readonly hasNoDishes = computed(() =>
    this.participants().every((participant) => participant.items.length === 0)
  );
  readonly statusLabel = computed(() => {
    switch (this.groupStatus()?.status) {
      case 'Open':
        return 'Collecting pre-orders';
      case 'Submitted':
        return 'Sent to Restaurant';
      case 'Closed':
        return 'Closed';
      default:
        return '';
    }
  });

  private reservationId = '';
  private pollingSubscription?: Subscription;
  private readonly submitStarted = signal(false);

  ngOnInit(): void {
    this.reservationId = this.route.snapshot.paramMap.get('reservationId') ?? '';
    this.loadGroup();
  }

  loadGroup(): void {
    if (!this.reservationId) {
      this.isLoading.set(false);
      this.errorMessage.set('Group reservation not found');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.groupOrdersService
      .getGroupInvite$(this.reservationId)
      .pipe(
        tap((invite) => this.invite.set(invite)),
        exhaustMap((invite) =>
          forkJoin({
            sessions: this.groupOrdersService.getSessions$(invite.GroupReservationId),
            ownerSessionId: this.groupOrdersService.getOwnerSessionId$(this.reservationId),
            status: this.groupOrdersService.getStatus$(invite.GroupReservationId),
          })
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.setGroupData(data);
          this.isLoading.set(false);
          this.lastUpdated.set(new Date());
          this.startPolling();
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'Group reservation not found'
              : 'Could not load the group reservation. Please try again.'
          );
        },
      });
  }

  refreshNow(): void {
    if (this.isRefreshing() || this.isLoading() || this.submitStarted()) return;
    this.refreshGroupData(false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  openSubmitDialog(): void {
    if (!this.canSubmit()) return;
    this.isSubmitDialogOpen.set(true);
  }

  closeSubmitDialog(): void {
    if (!this.isSubmitting()) this.isSubmitDialogOpen.set(false);
  }

  canSubmit(): boolean {
    return (
      this.groupStatus()?.status === 'Open' &&
      this.consolidatedOrder().items.length > 0 &&
      !this.isSubmitting()
    );
  }

  submitPreOrder(): void {
    const groupReservationId = this.invite()?.GroupReservationId;
    if (!groupReservationId || !this.canSubmit()) return;

    this.stopPolling();
    this.submitStarted.set(true);
    this.isSubmitting.set(true);

    this.groupOrdersService
      .submit$(groupReservationId, this.reservationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const currentStatus = this.groupStatus();
          this.groupStatus.set(
            currentStatus ? { ...currentStatus, status: 'Submitted' } : currentStatus
          );
          this.isSubmitting.set(false);
          this.isSubmitDialogOpen.set(false);
          this.toastService.success('Pre-order sent to the restaurant', 'Success');
        },
        error: () => {
          this.isSubmitting.set(false);
          this.submitStarted.set(false);
        },
      });
  }

  openRemoveGuestDialog(guest: Participant): void {
    if (guest.type !== 'Guest' || this.groupStatus()?.status !== 'Open') return;
    this.selectedGuest.set(guest);
  }

  closeRemoveGuestDialog(): void {
    if (!this.isRemovingGuest()) this.selectedGuest.set(null);
  }

  removeGuest(): void {
    const guest = this.selectedGuest();
    const groupReservationId = this.invite()?.GroupReservationId;
    if (!guest || !groupReservationId || this.isRemovingGuest()) return;

    this.isRemovingGuest.set(true);
    this.groupOrdersService
      .removeSession$(groupReservationId, guest.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isRemovingGuest.set(false))
      )
      .subscribe({
        next: (sessions) => {
          this.participants.set(sessions.participants);
          this.selectedGuest.set(null);
          this.lastUpdated.set(new Date());
          this.refreshFailed.set(false);
        },
        error: () => {
          // Keep the current snapshot so the owner can retry without losing the guest list.
        },
      });
  }

  private setGroupData(data: GroupScreenData): void {
    this.participants.set(data.sessions.participants);
    this.ownerSessionId.set(data.ownerSessionId);
    this.groupStatus.set(data.status);
  }

  private startPolling(): void {
    if (this.groupStatus()?.status !== 'Open' || this.pollingSubscription) return;

    this.pollingSubscription = timer(SYNC_INTERVAL_MS, SYNC_INTERVAL_MS)
      .pipe(
        exhaustMap(() => this.refreshGroupData(true)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private stopPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = undefined;
  }

  private refreshGroupData(silent: boolean): Observable<void> {
    const groupReservationId = this.invite()?.GroupReservationId;
    if (!groupReservationId) return EMPTY;

    this.isRefreshing.set(true);
    return forkJoin({
      sessions: this.groupOrdersService.getSessions$(
        groupReservationId,
        silent ? { silent: true } : {}
      ),
      status: this.groupOrdersService.getStatus$(
        groupReservationId,
        silent ? { silent: true } : {}
      ),
    }).pipe(
      tap(({ sessions, status }) => {
        this.participants.set(sessions.participants);
        this.groupStatus.set(status);
        this.lastUpdated.set(new Date());
        this.refreshFailed.set(false);
        if (status.status !== 'Open') this.stopPolling();
      }),
      map(() => undefined),
      catchError(() => {
        this.refreshFailed.set(true);
        return EMPTY;
      }),
      finalize(() => this.isRefreshing.set(false))
    );
  }
}
