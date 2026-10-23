-- Run with SQLCMD against a disposable database ONLY.
-- Variables: MigrationScript = absolute path to the EF script from AddPurchasePayments to AddPurchaseShipmentLots.
-- This fixture reproduces the affected pre-migration tables, columns and index; it contains no production data.
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_NAME() NOT LIKE 'PoLotMigrationCheck[_]%' THROW 51000, 'Use a dedicated PoLotMigrationCheck_ test database.', 1;
CREATE TABLE purchase_trips (Id uniqueidentifier PRIMARY KEY, Status nvarchar(20) NOT NULL);
CREATE TABLE purchase_items (Id uniqueidentifier PRIMARY KEY, QtyBought decimal(12,3), QtyUsable decimal(12,3), QtyDamaged decimal(12,3), QtyMissing decimal(12,3), TotalCost decimal(14,2));
CREATE TABLE product_variants (Id uniqueidentifier PRIMARY KEY);
CREATE TABLE purchase_trip_costs (Id uniqueidentifier PRIMARY KEY);
CREATE TABLE purchase_shipments (Id uniqueidentifier PRIMARY KEY, TripId uniqueidentifier NOT NULL, ShippingCompanyId uniqueidentifier NOT NULL,
    PurchaseTripCostId uniqueidentifier NOT NULL, ChargeBasis nvarchar(20), BillableQuantity decimal(14,3), DeletedAt datetime2);
CREATE UNIQUE INDEX IX_purchase_shipments_TripId ON purchase_shipments(TripId) WHERE DeletedAt IS NULL;
CREATE TABLE purchase_receive_sessions (Id uniqueidentifier PRIMARY KEY, Status nvarchar(20), DeletedAt datetime2, TripId uniqueidentifier);
CREATE TABLE purchase_receive_session_items (Id uniqueidentifier PRIMARY KEY, PurchaseItemId uniqueidentifier, SessionId uniqueidentifier, QtyMissing decimal(12,3));
CREATE TABLE __EFMigrationsHistory (MigrationId nvarchar(150) PRIMARY KEY, ProductVersion nvarchar(32));
INSERT purchase_trips VALUES ('00000000-0000-0000-0000-000000000001','RECEIVING'),('00000000-0000-0000-0000-000000000002','PENDING_APPROVAL'),('00000000-0000-0000-0000-000000000003','COMPLETED');
INSERT purchase_items VALUES ('00000000-0000-0000-0000-000000000004',10,3,0,1,1000);
INSERT purchase_shipments VALUES ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001',NEWID(),NEWID(),'PER_KG',2.5,NULL);
INSERT purchase_receive_sessions VALUES ('00000000-0000-0000-0000-000000000006','APPROVED',NULL,'00000000-0000-0000-0000-000000000001');
INSERT purchase_receive_session_items VALUES (NEWID(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006',1);
GO
:r $(MigrationScript)
GO
IF (SELECT Status FROM purchase_trips WHERE Id='00000000-0000-0000-0000-000000000001') <> 'IN_PROGRESS' THROW 51000,'Receiving status not migrated.',1;
IF (SELECT Status FROM purchase_trips WHERE Id='00000000-0000-0000-0000-000000000002') <> 'DRAFT' THROW 51000,'Pending status not migrated.',1;
IF EXISTS (SELECT 1 FROM purchase_trips WHERE UsesShipmentLots <> 0) THROW 51000,'Historical completion flag not preserved.',1;
IF (SELECT QtyShipped FROM purchase_items) <> 4 THROW 51000,'Historical quantities not backfilled.',1;
IF (SELECT LossAmount FROM purchase_receive_session_items) <> 100 THROW 51000,'Historical missing loss not backfilled.',1;
IF (SELECT BilledWeightGrams FROM purchase_shipments) <> 2500 OR (SELECT IsLegacy FROM purchase_shipments) <> 1 THROW 51000,'Legacy shipment changed incorrectly.',1;
DECLARE @a uniqueidentifier=NEWID(), @b uniqueidentifier=NEWID(), @po uniqueidentifier='00000000-0000-0000-0000-000000000001';
INSERT purchase_shipments (Id,TripId,LotNo,Status) VALUES (@a,@po,'LOT-1','SENT'),(@b,@po,'LOT-2','SENT');
IF (SELECT COUNT(*) FROM purchase_shipments WHERE TripId=@po) <> 3 THROW 51000,'Multiple shipments per PO failed.',1;
BEGIN TRY
    INSERT purchase_shipments (Id,TripId,LotNo,Status) VALUES (NEWID(),@po,'LOT-1','READY');
    THROW 51000,'Duplicate lot number was accepted.',1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() NOT IN (2601,2627) THROW;
END CATCH;
INSERT purchase_receive_sessions (Id,Status,ShipmentId) VALUES (NEWID(),'REJECTED',@a),(NEWID(),'PENDING_APPROVAL',@a);
BEGIN TRY
    INSERT purchase_receive_sessions (Id,Status,ShipmentId) VALUES (NEWID(),'APPROVED',@a);
    THROW 51000,'Duplicate active receipt was accepted.',1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() NOT IN (2601,2627) THROW;
END CATCH;
PRINT 'PASS: migration backfill, multiple lots, unique lot numbers, and one active receipt per lot.';
