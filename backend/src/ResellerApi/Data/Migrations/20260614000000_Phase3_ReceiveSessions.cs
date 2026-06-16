using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    public partial class Phase3_ReceiveSessions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Move any PENDING_COMPLETION trips back to RECEIVING (status removed)
            migrationBuilder.Sql(@"
                UPDATE purchase_trips SET Status = 'RECEIVING'
                WHERE Status = 'PENDING_COMPLETION';
            ");

            // 2. Nullify then drop ReceivedAt on purchase_items
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_items') AND name = N'ReceivedAt'
                )
                BEGIN
                    ALTER TABLE purchase_items DROP COLUMN ReceivedAt;
                END
            ");

            // 3. Make QtyUsable NOT NULL (set NULLs to 0 first)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_items') AND name = N'QtyUsable'
                      AND is_nullable = 1
                )
                BEGIN
                    UPDATE purchase_items SET QtyUsable = 0 WHERE QtyUsable IS NULL;
                    ALTER TABLE purchase_items ALTER COLUMN QtyUsable DECIMAL(12,3) NOT NULL;
                END
            ");

            // 4. Make QtyDamaged NOT NULL (set NULLs to 0 first)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_items') AND name = N'QtyDamaged'
                      AND is_nullable = 1
                )
                BEGIN
                    UPDATE purchase_items SET QtyDamaged = 0 WHERE QtyDamaged IS NULL;
                    ALTER TABLE purchase_items ALTER COLUMN QtyDamaged DECIMAL(12,3) NOT NULL;
                END
            ");

            // 5. Create purchase_receive_sessions
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'purchase_receive_sessions')
                BEGIN
                    CREATE TABLE purchase_receive_sessions (
                        Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
                        BusinessId uniqueidentifier NOT NULL,
                        TripId uniqueidentifier NOT NULL,
                        SessionNo nvarchar(20) NOT NULL,
                        ReceivedBy uniqueidentifier NOT NULL,
                        ReceivedAt datetime2 NOT NULL,
                        TransportMode nvarchar(30) NOT NULL,
                        VehicleOrTrackingNo nvarchar(100) NULL,
                        Note nvarchar(500) NULL,
                        Status nvarchar(20) NOT NULL DEFAULT 'PENDING_APPROVAL',
                        ApprovedBy uniqueidentifier NULL,
                        ApprovedAt datetime2 NULL,
                        RejectionReason nvarchar(500) NULL,
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        DeletedAt datetime2 NULL,
                        RowVer rowversion NOT NULL,
                        CONSTRAINT PK_purchase_receive_sessions PRIMARY KEY (Id),
                        CONSTRAINT FK_purchase_receive_sessions_purchase_trips_TripId
                            FOREIGN KEY (TripId) REFERENCES purchase_trips(Id) ON DELETE CASCADE,
                        CONSTRAINT FK_purchase_receive_sessions_users_ReceivedBy
                            FOREIGN KEY (ReceivedBy) REFERENCES users(Id) ON DELETE NO ACTION,
                        CONSTRAINT FK_purchase_receive_sessions_users_ApprovedBy
                            FOREIGN KEY (ApprovedBy) REFERENCES users(Id) ON DELETE NO ACTION
                    );
                    CREATE INDEX IX_purchase_receive_sessions_TripId ON purchase_receive_sessions(TripId);
                    CREATE INDEX IX_purchase_receive_sessions_BusinessId ON purchase_receive_sessions(BusinessId);
                    CREATE INDEX IX_purchase_receive_sessions_ReceivedBy ON purchase_receive_sessions(ReceivedBy);
                    CREATE INDEX IX_purchase_receive_sessions_ApprovedBy ON purchase_receive_sessions(ApprovedBy);
                END
            ");

            // 6. Create purchase_receive_session_items
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'purchase_receive_session_items')
                BEGIN
                    CREATE TABLE purchase_receive_session_items (
                        Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
                        SessionId uniqueidentifier NOT NULL,
                        PurchaseItemId uniqueidentifier NOT NULL,
                        QtyUsable DECIMAL(12,3) NOT NULL DEFAULT 0,
                        QtyDamaged DECIMAL(12,3) NOT NULL DEFAULT 0,
                        PerLotValuesJson nvarchar(2000) NOT NULL DEFAULT '{}',
                        CreatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        UpdatedAt datetime2 NOT NULL DEFAULT GETUTCDATE(),
                        DeletedAt datetime2 NULL,
                        RowVer rowversion NOT NULL,
                        CONSTRAINT PK_purchase_receive_session_items PRIMARY KEY (Id),
                        CONSTRAINT FK_purchase_receive_session_items_sessions_SessionId
                            FOREIGN KEY (SessionId) REFERENCES purchase_receive_sessions(Id) ON DELETE CASCADE,
                        CONSTRAINT FK_purchase_receive_session_items_purchase_items_PurchaseItemId
                            FOREIGN KEY (PurchaseItemId) REFERENCES purchase_items(Id) ON DELETE NO ACTION
                    );
                    CREATE INDEX IX_purchase_receive_session_items_SessionId ON purchase_receive_session_items(SessionId);
                    CREATE INDEX IX_purchase_receive_session_items_PurchaseItemId ON purchase_receive_session_items(PurchaseItemId);
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.tables WHERE name = N'purchase_receive_session_items')
                    DROP TABLE purchase_receive_session_items;
            ");
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.tables WHERE name = N'purchase_receive_sessions')
                    DROP TABLE purchase_receive_sessions;
            ");
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'purchase_items') AND name = N'ReceivedAt'
                )
                ALTER TABLE purchase_items ADD ReceivedAt datetime2 NULL;
            ");
        }
    }
}
