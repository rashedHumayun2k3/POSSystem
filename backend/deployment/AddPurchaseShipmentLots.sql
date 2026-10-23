BEGIN TRANSACTION;
DROP INDEX [IX_purchase_shipments_TripId] ON [purchase_shipments];

ALTER TABLE [purchase_trips] ADD [UsesShipmentLots] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [purchase_trip_costs] ADD [ShipmentId] uniqueidentifier NULL;

DECLARE @var sysname;
SELECT @var = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[purchase_shipments]') AND [c].[name] = N'ShippingCompanyId');
IF @var IS NOT NULL EXEC(N'ALTER TABLE [purchase_shipments] DROP CONSTRAINT [' + @var + '];');
ALTER TABLE [purchase_shipments] ALTER COLUMN [ShippingCompanyId] uniqueidentifier NULL;

DECLARE @var1 sysname;
SELECT @var1 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[purchase_shipments]') AND [c].[name] = N'PurchaseTripCostId');
IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [purchase_shipments] DROP CONSTRAINT [' + @var1 + '];');
ALTER TABLE [purchase_shipments] ALTER COLUMN [PurchaseTripCostId] uniqueidentifier NULL;

ALTER TABLE [purchase_shipments] ADD [BilledWeightGrams] decimal(14,3) NOT NULL DEFAULT 0.0;

ALTER TABLE [purchase_shipments] ADD [DeclaredWeightGrams] decimal(14,3) NOT NULL DEFAULT 0.0;

ALTER TABLE [purchase_shipments] ADD [IsLegacy] bit NOT NULL DEFAULT CAST(0 AS bit);

ALTER TABLE [purchase_shipments] ADD [LotNo] nvarchar(40) NOT NULL DEFAULT N'';

ALTER TABLE [purchase_shipments] ADD [MeasuredWeightGrams] decimal(14,3) NOT NULL DEFAULT 0.0;

ALTER TABLE [purchase_shipments] ADD [ShippedDate] datetime2 NULL;

ALTER TABLE [purchase_shipments] ADD [Status] nvarchar(20) NOT NULL DEFAULT N'';

ALTER TABLE [purchase_receive_sessions] ADD [ShipmentId] uniqueidentifier NULL;

ALTER TABLE [purchase_receive_session_items] ADD [AllocatedShippingCost] decimal(14,2) NOT NULL DEFAULT 0.0;

ALTER TABLE [purchase_receive_session_items] ADD [LossAmount] decimal(14,2) NOT NULL DEFAULT 0.0;

ALTER TABLE [purchase_receive_session_items] ADD [MeasuredWeightGrams] decimal(14,3) NOT NULL DEFAULT 0.0;

ALTER TABLE [purchase_items] ADD [QtyShipped] decimal(12,3) NOT NULL DEFAULT 0.0;

ALTER TABLE [product_variants] ADD [UnitWeightGrams] decimal(14,3) NOT NULL DEFAULT 0.0;

EXEC(N'UPDATE purchase_trips SET Status = CASE Status
                WHEN ''PENDING_APPROVAL'' THEN ''DRAFT'' WHEN ''RECEIVING'' THEN ''IN_PROGRESS'' ELSE Status END;
                UPDATE p SET Status = ''IN_PROGRESS'' FROM purchase_trips p WHERE p.Status = ''DRAFT''
                    AND EXISTS (SELECT 1 FROM purchase_receive_sessions s WHERE s.TripId = p.Id AND s.Status = ''APPROVED'' AND s.DeletedAt IS NULL);
                UPDATE purchase_shipments SET IsLegacy = 1, LotNo = ''LEGACY-'' + LEFT(CONVERT(varchar(36), Id), 32),
                    Status = CASE WHEN EXISTS (SELECT 1 FROM purchase_trips p WHERE p.Id = TripId AND p.Status = ''COMPLETED'')
                        THEN ''RECEIVED'' ELSE ''READY'' END,
                    BilledWeightGrams = CASE WHEN ChargeBasis = ''PER_KG'' THEN BillableQuantity * 1000 ELSE 0 END;
                UPDATE purchase_items SET QtyShipped = QtyUsable + QtyDamaged + QtyMissing;
                UPDATE r SET LossAmount = ROUND(CASE WHEN i.QtyBought > 0 THEN i.TotalCost / i.QtyBought * r.QtyMissing ELSE 0 END, 2)
                    FROM purchase_receive_session_items r JOIN purchase_items i ON i.Id = r.PurchaseItemId
                    JOIN purchase_receive_sessions s ON s.Id = r.SessionId WHERE s.Status = ''APPROVED'';');

CREATE TABLE [purchase_shipment_items] (
    [Id] uniqueidentifier NOT NULL,
    [ShipmentId] uniqueidentifier NOT NULL,
    [PurchaseItemId] uniqueidentifier NOT NULL,
    [Qty] decimal(12,3) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    [DeletedAt] datetime2 NULL,
    [RowVer] rowversion NOT NULL,
    CONSTRAINT [PK_purchase_shipment_items] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_purchase_shipment_items_purchase_items_PurchaseItemId] FOREIGN KEY ([PurchaseItemId]) REFERENCES [purchase_items] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_purchase_shipment_items_purchase_shipments_ShipmentId] FOREIGN KEY ([ShipmentId]) REFERENCES [purchase_shipments] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_purchase_trip_costs_ShipmentId] ON [purchase_trip_costs] ([ShipmentId]);

CREATE UNIQUE INDEX [IX_purchase_shipments_TripId_LotNo] ON [purchase_shipments] ([TripId], [LotNo]) WHERE [DeletedAt] IS NULL;

EXEC(N'CREATE UNIQUE INDEX [IX_purchase_receive_sessions_ShipmentId]
                ON [purchase_receive_sessions] ([ShipmentId])
                WHERE [ShipmentId] IS NOT NULL AND [DeletedAt] IS NULL AND [Status] <> ''REJECTED'';');

CREATE INDEX [IX_purchase_shipment_items_PurchaseItemId] ON [purchase_shipment_items] ([PurchaseItemId]);

CREATE UNIQUE INDEX [IX_purchase_shipment_items_ShipmentId_PurchaseItemId] ON [purchase_shipment_items] ([ShipmentId], [PurchaseItemId]) WHERE [DeletedAt] IS NULL;

ALTER TABLE [purchase_receive_sessions] ADD CONSTRAINT [FK_purchase_receive_sessions_purchase_shipments_ShipmentId] FOREIGN KEY ([ShipmentId]) REFERENCES [purchase_shipments] ([Id]);

ALTER TABLE [purchase_trip_costs] ADD CONSTRAINT [FK_purchase_trip_costs_purchase_shipments_ShipmentId] FOREIGN KEY ([ShipmentId]) REFERENCES [purchase_shipments] ([Id]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261022162615_AddPurchaseShipmentLots', N'9.0.9');

COMMIT;
GO

