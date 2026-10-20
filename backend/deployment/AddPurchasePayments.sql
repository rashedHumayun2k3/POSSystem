BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    CREATE TABLE [purchase_payments] (
        [Id] uniqueidentifier NOT NULL,
        [BranchId] uniqueidentifier NULL,
        [TripId] uniqueidentifier NOT NULL,
        [CostKey] uniqueidentifier NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [FundingSource] nvarchar(16) NOT NULL,
        [PartnerId] uniqueidentifier NULL,
        [CreatedBy] uniqueidentifier NOT NULL,
        [RequestId] uniqueidentifier NOT NULL,
        [PaidAt] datetime2 NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        [DeletedAt] datetime2 NULL,
        [RowVer] rowversion NOT NULL,
        [BusinessId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_purchase_payments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_purchase_payments_businesses_BusinessId] FOREIGN KEY ([BusinessId]) REFERENCES [businesses] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_purchase_payments_partners_PartnerId] FOREIGN KEY ([PartnerId]) REFERENCES [partners] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_purchase_payments_purchase_trips_TripId] FOREIGN KEY ([TripId]) REFERENCES [purchase_trips] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    CREATE INDEX [IX_purchase_payments_BusinessId_PaidAt] ON [purchase_payments] ([BusinessId], [PaidAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    CREATE UNIQUE INDEX [IX_purchase_payments_BusinessId_RequestId] ON [purchase_payments] ([BusinessId], [RequestId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    CREATE UNIQUE INDEX [IX_purchase_payments_BusinessId_TripId_CostKey] ON [purchase_payments] ([BusinessId], [TripId], [CostKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    CREATE INDEX [IX_purchase_payments_PartnerId] ON [purchase_payments] ([PartnerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    CREATE INDEX [IX_purchase_payments_TripId] ON [purchase_payments] ([TripId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261019052522_AddPurchasePayments'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261019052522_AddPurchasePayments', N'9.0.9');
END;

COMMIT;
GO

