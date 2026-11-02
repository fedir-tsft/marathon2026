import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CardReservationComponent } from './card-reservation.component';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { ReservationCustomer, ReservationStatusCustomer } from '@app/models/reservations/reservation.model';

const RESERVATION: ReservationCustomer = {
  id: 'res-1',
  tableId: 'table-1',
  startTime: new Date('2026-10-21T16:00:00Z'),
  endTime: new Date('2026-10-21T17:30:00Z'),
  guestCount: 2,
  status: ReservationStatusCustomer.Reserved,
  restaurantName: 'Green & Tasty',
  locationAddress: 'Rustaveli Avenue 48',
  waiterId: 'waiter-1',
};

describe('CardReservationComponent', () => {
  let component: CardReservationComponent;
  let fixture: ComponentFixture<CardReservationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [{ provide: API_BASE_URL, useValue: 'https://test.api' }, provideRouter([])],
      imports: [CardReservationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CardReservationComponent);
    component = fixture.componentInstance;
    // r — обов'язковий input: без нього компонент падає з NG0950
    fixture.componentRef.setInput('r', RESERVATION);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows Group Order for an open group reservation', () => {
    fixture.componentRef.setInput('r', {
      ...RESERVATION,
      guestInviteLinkAvailable: true,
    });
    fixture.detectChanges();

    const groupOrderButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) => button.nativeElement.textContent.trim() === 'Group Order');

    expect(groupOrderButton).toBeDefined();
  });

  it('navigates to the reservation group-order route', () => {
    fixture.componentRef.setInput('r', {
      ...RESERVATION,
      guestInviteLinkAvailable: true,
    });
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    component.onGroupOrder();

    expect(navigateSpy).toHaveBeenCalledWith([
      '/reservations',
      RESERVATION.id,
      'group-order',
    ]);
  });

  it('does not show Group Order when the group invite is unavailable', () => {
    fixture.componentRef.setInput('r', RESERVATION);
    fixture.detectChanges();

    const groupOrderButton = fixture.debugElement
      .queryAll(By.css('button'))
      .find((button) => button.nativeElement.textContent.trim() === 'Group Order');

    expect(groupOrderButton).toBeUndefined();
  });
});
