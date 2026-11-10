CREATE OR ALTER PROCEDURE dbo.DashboardMoneySection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 DECLARE @AsOf datetime2=SYSUTCDATETIME();
 -- Only movements with an explicit cash/wallet identity can be assigned here.
 -- Capital, petty cash and BUSINESS purchase funding do not identify this drawer.
 SELECT Method,Amount INTO #Movements FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
 AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL AND p.ReceivedAt<=@AsOf;
 INSERT #Movements(Method,Amount)
 SELECT v.Method,-v.Amount FROM dbo.expenses e
 CROSS APPLY(VALUES('CASH',e.CashAmount),('BKASH',e.BkashAmount),('NAGAD',e.NagadAmount)) v(Method,Amount)
 WHERE e.BusinessId=@BusinessId AND (@BranchId IS NULL OR e.BranchId=@BranchId)
 AND e.DeletedAt IS NULL AND e.Status='APPROVED' AND e.FundingSource='CASH'
 AND e.PaidAt IS NOT NULL AND e.PaidAt<=@AsOf;
 SELECT k.Name,COALESCE(SUM(m.Amount),0) Value INTO #Balances
 FROM (VALUES(1,'Cash','CASH','REFUND_CASH'),(2,'bKash','BKASH','REFUND_BKASH'),(3,'Nagad','NAGAD','REFUND_NAGAD')) k(Sort,Name,Method,Refund)
 LEFT JOIN #Movements m ON m.Method IN(k.Method,k.Refund) GROUP BY k.Sort,k.Name;
 SELECT (SELECT SUM(Value) FROM #Balances) Total,CONVERT(varchar(33),@AsOf,126)+'Z' AsOf,
 JSON_QUERY((SELECT Name,Value FROM #Balances ORDER BY CASE Name WHEN 'Cash' THEN 1 WHEN 'bKash' THEN 2 ELSE 3 END FOR JSON PATH)) Rows
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END
