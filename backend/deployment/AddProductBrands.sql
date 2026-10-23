BEGIN TRANSACTION;
ALTER TABLE [products] ADD [BrandId] uniqueidentifier NULL;

CREATE TABLE [brands] (
    [Id] uniqueidentifier NOT NULL,
    [Name] nvarchar(200) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NOT NULL,
    [DeletedAt] datetime2 NULL,
    [RowVer] rowversion NOT NULL,
    [BusinessId] uniqueidentifier NOT NULL,
    CONSTRAINT [PK_brands] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_brands_businesses_BusinessId] FOREIGN KEY ([BusinessId]) REFERENCES [businesses] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_products_BrandId] ON [products] ([BrandId]);

CREATE UNIQUE INDEX [IX_brands_BusinessId_Name] ON [brands] ([BusinessId], [Name]);

ALTER TABLE [products] ADD CONSTRAINT [FK_products_brands_BrandId] FOREIGN KEY ([BrandId]) REFERENCES [brands] ([Id]) ON DELETE NO ACTION;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261022175307_AddProductBrands', N'9.0.9');

COMMIT;
GO

