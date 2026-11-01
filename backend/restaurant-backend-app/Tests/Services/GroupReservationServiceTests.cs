using APIHandler.Constants;
using APIHandler.Entities;
using APIHandler.Exceptions;
using APIHandler.Models.GroupReservation;
using APIHandler.Models.GuestSessions;
using APIHandler.Repositories.GroupReservations;
using APIHandler.Repositories.GuestSessions;
using APIHandler.Repositories.Orders;
using APIHandler.Repositories.Reservations;
using APIHandler.Repositories.Tables;
using APIHandler.Services.Auth;
using APIHandler.Services.GuestSessions;
using APIHandler.Services.GroupReservations;
using APIHandler.Services.Locations;
using AutoFixture.Xunit2;
using Moq;

namespace APIHandler.Tests.Services;

public class GroupReservationServiceTests
{
    private readonly Mock<IGroupReservationRepository> _groupReservationRepositoryMock = new();
    private readonly Mock<ITableRepository> _tableRepositoryMock = new();
    private readonly Mock<IReservationRepository> _reservationRepositoryMock = new();
    private readonly Mock<IGuestSessionRepository> _guestSessionRepositoryMock = new();
    private readonly Mock<IOrderRepository> _orderRepositoryMock = new();
    private readonly Mock<IGuestSessionService> _guestSessionServiceMock = new();
    private readonly Mock<IUserService> _userServiceMock = new();
    private readonly Mock<ILocationService> _locationServiceMock = new();

    private readonly GroupReservationService _service;

    public GroupReservationServiceTests()
    {
        _service = new GroupReservationService(
            _groupReservationRepositoryMock.Object,
            _tableRepositoryMock.Object,
            _reservationRepositoryMock.Object,
            _guestSessionRepositoryMock.Object,
            _orderRepositoryMock.Object,
            _guestSessionServiceMock.Object,
            _userServiceMock.Object,
            _locationServiceMock.Object);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_Owner_ConsolidatesSubmittedSessionsAndUpdatesStatuses()
    {
        const string userId = "owner-user";
        const string reservationId = "reservation-id";
        const string groupReservationId = "group-id";
        var reservation = new Reservation
        {
            Id = reservationId,
            TableId = "table-id",
            WaiterId = "waiter-id",
            CustomerId = userId
        };
        var groupReservation = new GroupReservation
        {
            GroupReservationId = groupReservationId,
            ReservationId = reservationId,
            ReservationToken = "token",
            Status = GroupReservationStatus.Open
        };
        var sessions = new List<GuestSession>
        {
            new()
            {
                Id = "submitted-1",
                GroupReservationId = groupReservationId,
                GuestName = "Guest 1",
                IsSubmitted = true,
                Dishes =
                [
                    new OrderItem { DishId = "dish-1", Quantity = 2 },
                    new OrderItem { DishId = "dish-2", Quantity = 1 }
                ]
            },
            new()
            {
                Id = "submitted-2",
                GroupReservationId = groupReservationId,
                GuestName = "Guest 2",
                IsSubmitted = true,
                Dishes = [new OrderItem { DishId = "dish-1", Quantity = 1 }]
            },
            new()
            {
                Id = "unsubmitted",
                GroupReservationId = groupReservationId,
                GuestName = "Guest 3",
                IsSubmitted = false,
                Dishes = [new OrderItem { DishId = "ignored", Quantity = 9 }]
            }
        };
        var order = new Order
        {
            OrderId = "order-id",
            CustomerId = userId,
            ReservationId = reservationId,
            ReservationAddress = "Address",
            ReservationTime = "Time",
            Dishes = [],
            Status = OrderStatus.Created
        };

        _groupReservationRepositoryMock
            .Setup(repository => repository.GetGroupReservationByIdAsync(groupReservationId))
            .ReturnsAsync(groupReservation);
        _reservationRepositoryMock
            .Setup(repository => repository.GetReservationByIdAsync(reservationId))
            .ReturnsAsync(reservation);
        _guestSessionRepositoryMock
            .Setup(repository => repository.GetAllByGroupReservationIdAsync(groupReservationId))
            .ReturnsAsync(sessions);
        _orderRepositoryMock
            .Setup(repository => repository.GetOrderByReservationIdAsync(reservationId))
            .ReturnsAsync(order);

        var result = await _service.SubmitGroupPreOrderAsync(userId, groupReservationId, reservationId);

        Assert.Collection(
            result,
            dish =>
            {
                Assert.Equal("dish-1", dish.DishId);
                Assert.Equal(3, dish.Quantity);
            },
            dish =>
            {
                Assert.Equal("dish-2", dish.DishId);
                Assert.Equal(1, dish.Quantity);
            });
        Assert.Equal(OrderStatus.SubmittedByCustomer, order.Status);
        Assert.Equal(2, order.Dishes.Count);
        Assert.DoesNotContain(order.Dishes, dish => dish.DishId == "ignored");
        Assert.Equal(GroupReservationStatus.Submitted, groupReservation.Status);
        _orderRepositoryMock.Verify(repository => repository.SaveOrderAsync(order), Times.Once);
        _groupReservationRepositoryMock.Verify(repository => repository.SaveGroupReservationAsync(groupReservation), Times.Once);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_NoSubmittedSessions_ThrowsValidationException()
    {
        const string userId = "owner-user";
        var reservation = new Reservation
        {
            Id = "reservation-id",
            TableId = "table-id",
            WaiterId = "waiter-id",
            CustomerId = userId
        };
        var groupReservation = new GroupReservation
        {
            GroupReservationId = "group-id",
            ReservationId = reservation.Id,
            ReservationToken = "token",
            Status = GroupReservationStatus.Open
        };

        _groupReservationRepositoryMock
            .Setup(repository => repository.GetGroupReservationByIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(groupReservation);
        _reservationRepositoryMock
            .Setup(repository => repository.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);
        _guestSessionRepositoryMock
            .Setup(repository => repository.GetAllByGroupReservationIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(
            [
                new GuestSession
                {
                    Id = "unsubmitted",
                    GroupReservationId = groupReservation.GroupReservationId,
                    GuestName = "Guest",
                    Dishes = [new OrderItem { DishId = "dish", Quantity = 1 }],
                    IsSubmitted = false
                }
            ]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync(userId, groupReservation.GroupReservationId, reservation.Id));
        _orderRepositoryMock.Verify(repository => repository.SaveOrderAsync(It.IsAny<Order>()), Times.Never);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_SubmittedSessionsWithoutDishes_ThrowsValidationException()
    {
        const string userId = "owner-user";
        var reservation = new Reservation
        {
            Id = "reservation-id",
            TableId = "table-id",
            WaiterId = "waiter-id",
            CustomerId = userId
        };
        var groupReservation = new GroupReservation
        {
            GroupReservationId = "group-id",
            ReservationId = reservation.Id,
            ReservationToken = "token",
            Status = GroupReservationStatus.Open
        };

        _groupReservationRepositoryMock
            .Setup(repository => repository.GetGroupReservationByIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(groupReservation);
        _reservationRepositoryMock
            .Setup(repository => repository.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);
        _guestSessionRepositoryMock
            .Setup(repository => repository.GetAllByGroupReservationIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(
            [
                new GuestSession
                {
                    Id = "submitted-empty",
                    GroupReservationId = groupReservation.GroupReservationId,
                    GuestName = "Guest",
                    Dishes = [],
                    IsSubmitted = true
                }
            ]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync(userId, groupReservation.GroupReservationId, reservation.Id));
        _orderRepositoryMock.Verify(
            repository => repository.GetOrderByReservationIdAsync(It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_NonOwner_ThrowsActionForbiddenException()
    {
        var reservation = new Reservation
        {
            Id = "reservation-id",
            TableId = "table-id",
            WaiterId = "waiter-id",
            CustomerId = "owner-user"
        };
        var groupReservation = new GroupReservation
        {
            GroupReservationId = "group-id",
            ReservationId = reservation.Id,
            ReservationToken = "token",
            Status = GroupReservationStatus.Open
        };
        _groupReservationRepositoryMock
            .Setup(repository => repository.GetGroupReservationByIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(groupReservation);
        _reservationRepositoryMock
            .Setup(repository => repository.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        await Assert.ThrowsAsync<ActionForbiddenException>(() =>
            _service.SubmitGroupPreOrderAsync("another-user", groupReservation.GroupReservationId, reservation.Id));
        _guestSessionRepositoryMock.Verify(
            repository => repository.GetAllByGroupReservationIdAsync(It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task SubmitGroupPreOrderAsync_OrderNotFound_ThrowsValidationException()
    {
        const string userId = "owner-user";
        var reservation = new Reservation
        {
            Id = "reservation-id",
            TableId = "table-id",
            WaiterId = "waiter-id",
            CustomerId = userId
        };
        var groupReservation = new GroupReservation
        {
            GroupReservationId = "group-id",
            ReservationId = reservation.Id,
            ReservationToken = "token",
            Status = GroupReservationStatus.Open
        };
        _groupReservationRepositoryMock
            .Setup(repository => repository.GetGroupReservationByIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(groupReservation);
        _reservationRepositoryMock
            .Setup(repository => repository.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);
        _guestSessionRepositoryMock
            .Setup(repository => repository.GetAllByGroupReservationIdAsync(groupReservation.GroupReservationId))
            .ReturnsAsync(
            [
                new GuestSession
                {
                    Id = "submitted",
                    GroupReservationId = groupReservation.GroupReservationId,
                    GuestName = "Guest",
                    Dishes = [new OrderItem { DishId = "dish", Quantity = 1 }],
                    IsSubmitted = true
                }
            ]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _service.SubmitGroupPreOrderAsync(userId, groupReservation.GroupReservationId, reservation.Id));
        _groupReservationRepositoryMock.Verify(
            repository => repository.SaveGroupReservationAsync(It.IsAny<GroupReservation>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateGroupReservationAsync_CreatesOwnerSessionForCustomerReservation()
    {
        const string reservationId = "reservation-id";
        const string ownerUserId = "owner-user";
        var result = await _service.CreateGroupReservationAsync(reservationId, ownerUserId);

        Assert.Equal(reservationId, result.ReservationId);
        _groupReservationRepositoryMock.Verify(
            repository => repository.SaveGroupReservationAsync(It.Is<GroupReservation>(
                group => group.ReservationId == reservationId)),
            Times.Once);
        _guestSessionServiceMock.Verify(
            service => service.CreateGroupOwnerSessionAsync(ownerUserId, result.GroupReservationId),
            Times.Once);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationByTokenAsync_ValidInput_ReturnsGroupReservationInfo(
        GroupReservation groupReservation,
        Table table,
        Reservation reservation,
        Location location,
        string expectedUserName)
    {
        groupReservation.ReservationId = reservation.Id;
        groupReservation.Status = GroupReservationStatus.Open;
        reservation.TableId = table.Id;
        table.LocationId = location.Id;

        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(groupReservation.ReservationToken))
            .ReturnsAsync(groupReservation);

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _guestSessionRepositoryMock
            .Setup(r => r.CountByGroupReservationId(groupReservation.GroupReservationId))
            .ReturnsAsync(0);

        _tableRepositoryMock
            .Setup(r => r.GetTableAsync(table.Id))
            .ReturnsAsync(table);

        _locationServiceMock
            .Setup(s => s.GetLocationByIdAsync(table.LocationId))
            .ReturnsAsync(location);

        _userServiceMock
            .Setup(s => s.GetUserName(reservation.CustomerId!))
            .ReturnsAsync(expectedUserName);

        var result = await _service.GetGroupReservationByTokenAsync(groupReservation.ReservationToken);

        Assert.Equal(groupReservation.GroupReservationId, result.GroupReservationId);
        Assert.Equal(table.LocationId, result.LocationId);
        Assert.Equal(reservation.GuestCount, result.MaxGuestCount);
        Assert.Equal(reservation.StartTime, result.StartTime);
        Assert.Equal(reservation.EndTime, result.EndTime);
        Assert.Equal(table.TableNumber, result.TableNumber);
        Assert.Equal("Green & Tasty", result.RestaurantName);
        Assert.Equal(location.Address, result.LocationAddress);
        Assert.Equal(expectedUserName, result.InviterName);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationByTokenAsync_InvalidToken_ThrowsNotFound(string token)
    {
        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(token))
            .ReturnsAsync((GroupReservation?)null);

        await Assert.ThrowsAsync<GroupReservationNotFoundException>(() => _service.GetGroupReservationByTokenAsync(token));
    }

    [Theory]
    [InlineAutoData(GroupReservationStatus.Closed)]
    [InlineAutoData(GroupReservationStatus.Submitted)]
    public async Task GetGroupReservationByTokenAsync_GroupReservationIsNotOpen_ThrowsException(
        GroupReservationStatus status,
        GroupReservation groupReservation)
    {
        groupReservation.Status = status;

        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(groupReservation.ReservationToken))
            .ReturnsAsync(groupReservation);

        await Assert.ThrowsAsync<GroupReservationExpiredException>(() => _service.GetGroupReservationByTokenAsync(groupReservation.ReservationToken));
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationByTokenAsync_WhenGuestCountIsMax_ThrowsGuestLimitExceeded(GroupReservation groupReservation, Reservation reservation)
    {
        groupReservation.Status = GroupReservationStatus.Open;
        groupReservation.ReservationId = reservation.Id;

        _groupReservationRepositoryMock
            .Setup(r => r.GetGroupReservationByTokenAsync(groupReservation.ReservationToken))
            .ReturnsAsync(groupReservation);

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _guestSessionRepositoryMock
            .Setup(r => r.CountByGroupReservationId(groupReservation.GroupReservationId))
            .ReturnsAsync(reservation.GuestCount);

        await Assert.ThrowsAsync<GuestLimitExceededException>(() => _service.GetGroupReservationByTokenAsync(groupReservation.ReservationToken));
    }

    [Theory]
    [AutoData]
    public async Task CloseGroupReservationAsync_ValidInput_UpdatesGroupReservationStatus(GroupReservation groupReservation)
    {
        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(groupReservation.ReservationId))
            .ReturnsAsync(groupReservation);

        GroupReservation? savedGroupReservation = null;
        _groupReservationRepositoryMock
            .Setup(r => r.SaveGroupReservationAsync(It.IsAny<GroupReservation>()))
            .Callback<GroupReservation>(r => savedGroupReservation = r);

        await _service.CloseGroupReservationAsync(groupReservation.ReservationId);

        Assert.NotNull(savedGroupReservation);
        Assert.Equal(GroupReservationStatus.Closed, savedGroupReservation.Status);
    }

    [Theory]
    [AutoData]
    public async Task CloseGroupReservationAsync_GroupReservationNotFound_DoesNotThrowException(string reservationId)
    {
        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(reservationId))
            .ReturnsAsync((GroupReservation?)null);

        await _service.CloseGroupReservationAsync(reservationId);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationInviteTokenAsync_ValidInput_ReturnsToken(Reservation reservation, GroupReservation groupReservation)
    {
        reservation.Status = ReservationStatus.Reserved;
        reservation.GuestCount = 3;
        groupReservation.ReservationId = reservation.Id;
        groupReservation.Status = GroupReservationStatus.Open;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(reservation.Id))
            .ReturnsAsync(groupReservation);

        GetGroupInviteTokenResponse result = await _service.GetGroupReservationInviteTokenAsync(reservation.Id);

        Assert.Equal(groupReservation.ReservationToken, result.Token);
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationInviteTokenAsync_InvalidReservationId_ThrowsNotFound(string reservationId)
    {
        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservationId))
            .ReturnsAsync((Reservation?)null);

        await Assert.ThrowsAsync<ReservationNotFoundException>(() => _service.GetGroupReservationInviteTokenAsync(reservationId));
    }

    [Theory]
    [AutoData]
    public async Task GetGroupReservationInviteTokenAsync_OneGuest_ThrowsValidationException(Reservation reservation)
    {
        reservation.Status = ReservationStatus.Reserved;
        reservation.GuestCount = 1;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        await Assert.ThrowsAsync<ValidationException>(() => _service.GetGroupReservationInviteTokenAsync(reservation.Id));
    }

    [Theory]
    [InlineAutoData(ReservationStatus.Completed)]
    [InlineAutoData(ReservationStatus.Cancelled)]
    [InlineAutoData(ReservationStatus.InProgress)]
    public async Task GetGroupReservationInviteTokenAsync_StatusIsNotReserved_ThrowsValidationException(ReservationStatus reservationStatus, Reservation reservation)
    {
        reservation.Status = reservationStatus;
        reservation.GuestCount = 1;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        await Assert.ThrowsAsync<ValidationException>(() => _service.GetGroupReservationInviteTokenAsync(reservation.Id));
    }

    [Theory]
    [InlineAutoData(GroupReservationStatus.Closed, typeof(GroupReservationExpiredException))]
    [InlineAutoData(GroupReservationStatus.Submitted, typeof(GroupReservationSubmittedException))]
    public async Task GetGroupReservationInviteTokenAsync_GroupStatusIsNotOpen_ThrowsException(GroupReservationStatus status, Type type, Reservation reservation, GroupReservation groupReservation)
    {
        reservation.Status = ReservationStatus.Reserved;
        reservation.GuestCount = 3;
        groupReservation.ReservationId = reservation.Id;
        groupReservation.Status = status;

        _reservationRepositoryMock
            .Setup(r => r.GetReservationByIdAsync(reservation.Id))
            .ReturnsAsync(reservation);

        _groupReservationRepositoryMock
            .Setup(r => r.GetByReservationIdAsync(reservation.Id))
            .ReturnsAsync(groupReservation);

        await Assert.ThrowsAsync(type, () => _service.GetGroupReservationInviteTokenAsync(reservation.Id));
    }
}
