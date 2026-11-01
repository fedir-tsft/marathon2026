using System.Collections.Generic;
using System.Text.Json.Serialization;
using APIHandler.Models.Orders;

namespace APIHandler.Models.GuestSessions;

public record GetAllSessionsResponse(IEnumerable<Participant> Participants, decimal Total);

public record Participant(
    string? Id,
    [property: JsonConverter(typeof(JsonStringEnumConverter<ParticipantType>))] ParticipantType Type,
    string Name,
    IEnumerable<OrderItemResponse> Items,
    decimal Total,
    bool IsSubmitted);

public enum ParticipantType
{
    Owner,
    Guest
}

public record GetGroupReservationSessionsResponse(IEnumerable<GroupParticipant> Participants, decimal Total);

public record GroupParticipant(
    string? Id,
    [property: JsonConverter(typeof(JsonStringEnumConverter<ParticipantType>))] ParticipantType Type,
    string Name,
    IEnumerable<GroupParticipantOrderItem> Items,
    decimal Total,
    bool IsSubmitted);

public record GroupParticipantOrderItem(GroupParticipantDish Dish, int Quantity);

public record GroupParticipantDish(string Id, string Name, decimal Price);
