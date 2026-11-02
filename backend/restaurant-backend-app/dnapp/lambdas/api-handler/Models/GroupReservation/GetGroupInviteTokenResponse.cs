using System;

namespace APIHandler.Models.GroupReservation;

public record GetGroupInviteTokenResponse(
    string Token,
    string GroupReservationId,
    string LocationId,
    string RestaurantName,
    string LocationAddress,
    DateTime StartTime,
    DateTime EndTime,
    int MaxGuestCount,
    int TableNumber,
    string InviterName);