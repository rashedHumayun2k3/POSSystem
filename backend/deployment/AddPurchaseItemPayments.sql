BEGIN TRANSACTION;
ALTER TABLE [purchase_payments] ADD [PurchaseItemId] uniqueidentifier NULL;

CREATE INDEX [IX_purchase_payments_PurchaseItemId] ON [purchase_payments] ([PurchaseItemId]);

ALTER TABLE [purchase_payments] ADD CONSTRAINT [FK_purchase_payments_purchase_items_PurchaseItemId] FOREIGN KEY ([PurchaseItemId]) REFERENCES [purchase_items] ([Id]) ON DELETE NO ACTION;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261023093303_AddPurchaseItemPayments', N'9.0.9');

COMMIT;
GO

