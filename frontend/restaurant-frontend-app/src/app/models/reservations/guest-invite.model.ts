export interface GuestInvite {
  GroupReservationId: string;
  LocationId: string;
  RestaurantName: string;
  LocationAddress: string;
  StartTime: string;
  EndTime: string;
  MaxGuestCount: number;
  TableNumber: number;
  InviterName: string;
}

export interface GroupInviteToken {
  token: string;
  groupReservationId: string;
  locationId: string;
  restaurantName: string;
  locationAddress: string;
  startTime: string;
  endTime: string;
  maxGuestCount: number;
  tableNumber: number;
  inviterName: string;
}
