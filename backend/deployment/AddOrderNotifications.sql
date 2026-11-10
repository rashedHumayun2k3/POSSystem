BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE TABLE [order_notification_events] (
        [OrderId] uniqueidentifier NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [ProcessedAt] datetime2 NULL,
        CONSTRAINT [PK_order_notification_events] PRIMARY KEY ([OrderId]),
        CONSTRAINT [FK_order_notification_events_orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [orders] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE TABLE [order_notifications] (
        [Id] uniqueidentifier NOT NULL,
        [OrderId] uniqueidentifier NOT NULL,
        [BusinessId] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NULL,
        [RecipientId] uniqueidentifier NOT NULL,
        [OrderNo] nvarchar(100) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [ReadAt] datetime2 NULL,
        CONSTRAINT [PK_order_notifications] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_order_notifications_orders_OrderId] FOREIGN KEY ([OrderId]) REFERENCES [orders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_order_notifications_users_RecipientId] FOREIGN KEY ([RecipientId]) REFERENCES [users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE TABLE [push_devices] (
        [Id] uniqueidentifier NOT NULL,
        [Token] nvarchar(250) NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [BusinessId] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NULL,
        [RefreshTokenId] uniqueidentifier NOT NULL,
        [Language] nvarchar(5) NOT NULL,
        [Enabled] bit NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_push_devices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_push_devices_users_UserId] FOREIGN KEY ([UserId]) REFERENCES [users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE TABLE [order_push_deliveries] (
        [Id] uniqueidentifier NOT NULL,
        [NotificationId] uniqueidentifier NOT NULL,
        [DeviceId] uniqueidentifier NOT NULL,
        [TicketId] nvarchar(100) NULL,
        [State] nvarchar(20) NOT NULL,
        [Attempts] int NOT NULL,
        [NextAttemptAt] datetime2 NOT NULL,
        [SentAt] datetime2 NULL,
        [LastError] nvarchar(100) NULL,
        CONSTRAINT [PK_order_push_deliveries] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_order_push_deliveries_order_notifications_NotificationId] FOREIGN KEY ([NotificationId]) REFERENCES [order_notifications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_order_push_deliveries_push_devices_DeviceId] FOREIGN KEY ([DeviceId]) REFERENCES [push_devices] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_order_notification_events_ProcessedAt_CreatedAt] ON [order_notification_events] ([ProcessedAt], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_order_notifications_BusinessId_RecipientId_ReadAt_CreatedAt] ON [order_notifications] ([BusinessId], [RecipientId], [ReadAt], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE UNIQUE INDEX [IX_order_notifications_OrderId_RecipientId] ON [order_notifications] ([OrderId], [RecipientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_order_notifications_RecipientId] ON [order_notifications] ([RecipientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_order_push_deliveries_DeviceId] ON [order_push_deliveries] ([DeviceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE UNIQUE INDEX [IX_order_push_deliveries_NotificationId_DeviceId] ON [order_push_deliveries] ([NotificationId], [DeviceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_order_push_deliveries_State_NextAttemptAt] ON [order_push_deliveries] ([State], [NextAttemptAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_push_devices_BusinessId_UserId_Enabled] ON [push_devices] ([BusinessId], [UserId], [Enabled]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_push_devices_RefreshTokenId] ON [push_devices] ([RefreshTokenId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE UNIQUE INDEX [IX_push_devices_Token] ON [push_devices] ([Token]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    CREATE INDEX [IX_push_devices_UserId] ON [push_devices] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030053909_AddOrderNotifications'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261030053909_AddOrderNotifications', N'9.0.9');
END;

COMMIT;
GO

