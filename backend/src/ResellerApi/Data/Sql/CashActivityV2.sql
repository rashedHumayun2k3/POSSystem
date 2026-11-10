-- Money flow: IN = sale payments + approved CASH partner investments.
-- OUT = refunds + all business expenses + purchase payments from business capital.
-- Personally paid expenses/purchases are excluded: no business money moved.
-- Money without a wallet identity (capital, business-funded payments) is counted as Cash.
CREATE OR ALTER FUNCTION dbo.CashFlowMovements(@BusinessId uniqueidentifier, @BranchId uniqueidentifier, @End datetime2)
RETURNS TABLE AS RETURN
 SELECT p.Id, p.OrderId ReferenceId, CAST('ORDER' AS varchar(10)) ReferenceType,
  CAST(CASE WHEN p.Amount<0 THEN 'REFUND' ELSE 'PAYMENT' END AS varchar(20)) Kind,
  CAST(REPLACE(p.Method,'REFUND_','') AS varchar(10)) Source, p.ReceivedAt At, CAST(p.Amount AS decimal(18,2)) Amount, CAST(o.OrderNo AS nvarchar(150)) Title
 FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
 AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL AND p.Amount<>0
 AND p.Method IN ('CASH','BKASH','NAGAD','REFUND_CASH','REFUND_BKASH','REFUND_NAGAD') AND p.ReceivedAt<@End
 UNION ALL
 SELECT e.Id,e.Id,'EXPENSE','EXPENSE',v.Source,e.PaidAt,-v.Amount,COALESCE(NULLIF(e.Title,''),NULLIF(e.SubType,''),N'Expense')
 FROM dbo.expenses e CROSS APPLY(VALUES('CASH',e.CashAmount),('BKASH',e.BkashAmount),('NAGAD',e.NagadAmount))v(Source,Amount)
 WHERE e.BusinessId=@BusinessId AND (@BranchId IS NULL OR e.BranchId=@BranchId) AND e.DeletedAt IS NULL AND e.Status='APPROVED'
 AND e.FundingSource='CASH' AND e.PaidAt IS NOT NULL AND e.PaidAt<@End AND v.Amount<>0
 UNION ALL
 SELECT e.Id,e.Id,'EXPENSE','EXPENSE','CASH',COALESCE(e.PaidAt,e.ExpenseDate),-e.Amount,COALESCE(NULLIF(e.Title,''),NULLIF(e.SubType,''),N'Expense')
 FROM dbo.expenses e
 WHERE e.BusinessId=@BusinessId AND (@BranchId IS NULL OR e.BranchId=@BranchId) AND e.DeletedAt IS NULL AND e.Status='APPROVED'
 AND (e.FundingSource IS NULL OR e.FundingSource='BUSINESS') AND e.Amount<>0 AND COALESCE(e.PaidAt,e.ExpenseDate)<@End
 UNION ALL
 SELECT pp.Id,pp.TripId,'PURCHASE','PURCHASE','CASH',pp.PaidAt,-pp.Amount,CAST(t.TripNo AS nvarchar(150))
 FROM dbo.purchase_payments pp JOIN dbo.purchase_trips t ON t.Id=pp.TripId
 WHERE pp.BusinessId=@BusinessId AND (@BranchId IS NULL OR pp.BranchId=@BranchId) AND pp.DeletedAt IS NULL
 AND pp.FundingSource='BUSINESS' AND pp.Amount<>0 AND pp.PaidAt<@End
 UNION ALL
 -- Capital is business-wide, so it is shown for every branch view.
 SELECT c.Id,c.PartnerId,'CAPITAL','INVESTMENT','CASH',c.InjectedAt,CAST(c.AmountPaisa AS decimal(18,2))/100,CAST(pa.Name AS nvarchar(150))
 FROM dbo.capital_injections c JOIN dbo.partners pa ON pa.Id=c.PartnerId
 WHERE c.BusinessId=@BusinessId AND c.DeletedAt IS NULL AND c.Status='APPROVED' AND c.ExpenseId IS NULL
 AND c.PaymentMethod='CASH' AND c.AmountPaisa<>0 AND c.InjectedAt<@End;
GO
CREATE OR ALTER PROCEDURE dbo.CashActivityReport
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL,
 @From date, @To date, @Source varchar(10)='CASH', @Direction varchar(5)='ALL', @Page int=1
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @From IS NULL OR @To IS NULL OR @From>@To OR DATEDIFF(day,@From,@To)>365 OR @Page<1 OR @Page>1000000
    OR @Source NOT IN ('ALL','CASH','BKASH','NAGAD') OR @Direction NOT IN ('ALL','IN','OUT')
    THROW 51000,'Invalid cash report filters.',1;
 DECLARE @AsOf datetime2=SYSUTCDATETIME(), @Start datetime2=DATEADD(hour,-6,CAST(@From AS datetime2)),
  @End datetime2=DATEADD(hour,-6,DATEADD(day,1,CAST(@To AS datetime2)));
 IF @End>@AsOf SET @End=@AsOf;
 SELECT * INTO #Movements FROM dbo.CashFlowMovements(@BusinessId,@BranchId,@End) WHERE (@Source='ALL' OR Source=@Source);
 SELECT COALESCE(SUM(CASE WHEN At<@Start THEN Amount ELSE 0 END),0) Opening,
  COALESCE(SUM(CASE WHEN At>=@Start AND Amount>0 THEN Amount ELSE 0 END),0) MoneyIn,
  COALESCE(SUM(CASE WHEN At>=@Start AND Amount<0 THEN -Amount ELSE 0 END),0) MoneyOut,
  COALESCE(SUM(Amount),0) Closing,
  COALESCE(SUM(CASE WHEN At>=@Start AND Kind='PAYMENT' THEN Amount ELSE 0 END),0) SalesIn,
  COALESCE(SUM(CASE WHEN At>=@Start AND Kind='INVESTMENT' THEN Amount ELSE 0 END),0) InvestmentIn,
  COALESCE(SUM(CASE WHEN At>=@Start AND Kind='EXPENSE' THEN -Amount ELSE 0 END),0) ExpenseOut,
  COALESCE(SUM(CASE WHEN At>=@Start AND Kind='PURCHASE' THEN -Amount ELSE 0 END),0) PurchaseOut,
  COALESCE(SUM(CASE WHEN At>=@Start AND Kind='REFUND' THEN -Amount ELSE 0 END),0) RefundOut,
  COUNT(CASE WHEN At>=@Start THEN 1 END) AllCount,
  COUNT(CASE WHEN At>=@Start AND Amount>0 THEN 1 END) InCount,
  COUNT(CASE WHEN At>=@Start AND Amount<0 THEN 1 END) OutCount
 INTO #Summary FROM #Movements;
 DECLARE @Opening decimal(28,2)=(SELECT Opening FROM #Summary);
 SELECT CONVERT(varchar(10),DATEADD(hour,6,At),23) [Date],
  SUM(CASE WHEN Amount>0 THEN Amount ELSE 0 END) MoneyIn,SUM(CASE WHEN Amount<0 THEN -Amount ELSE 0 END) MoneyOut,SUM(Amount) Net
 INTO #Days FROM #Movements WHERE At>=@Start GROUP BY CONVERT(varchar(10),DATEADD(hour,6,At),23);
 SELECT * INTO #Page FROM #Movements WHERE At>=@Start
 AND (@Direction='ALL' OR (@Direction='IN' AND Amount>0) OR (@Direction='OUT' AND Amount<0))
 ORDER BY At DESC,Id DESC,Source OFFSET (@Page-1)*50 ROWS FETCH NEXT 50 ROWS ONLY;
 SELECT CONVERT(varchar(10),@From,23) [From],CONVERT(varchar(10),@To,23) [To],
  CONVERT(varchar(33),@AsOf,126)+'Z' AsOf,@Source Source,@Direction Direction,@Page Page,50 PageSize,
  s.Opening,s.MoneyIn,s.MoneyOut,s.Closing,s.SalesIn,s.InvestmentIn,s.ExpenseOut,s.PurchaseOut,s.RefundOut,
  s.AllCount,s.InCount,s.OutCount,
  CASE @Direction WHEN 'IN' THEN s.InCount WHEN 'OUT' THEN s.OutCount ELSE s.AllCount END TotalItems,
  JSON_QUERY(COALESCE((SELECT d.[Date],d.MoneyIn,d.MoneyOut,d.Closing FROM (
   SELECT [Date],MoneyIn,MoneyOut,@Opening+SUM(Net) OVER(ORDER BY [Date] ROWS UNBOUNDED PRECEDING) Closing FROM #Days
  ) d ORDER BY d.[Date] DESC FOR JSON PATH),'[]')) Days,
  JSON_QUERY(COALESCE((SELECT m.Id,m.ReferenceId,m.ReferenceType,m.Kind,m.Source,m.Amount,m.Title,
   CONVERT(varchar(33),m.At,126)+'Z' At,CONVERT(varchar(10),DATEADD(hour,6,m.At),23) [Date],
   productNames.FirstProduct,COALESCE(productNames.ProductCount,0) ProductCount
   FROM #Page m OUTER APPLY(
    SELECT MIN(names.Name) FirstProduct,COUNT(*) ProductCount FROM (
     SELECT DISTINCT p.Id,p.Name FROM dbo.order_items i
     JOIN dbo.product_variants v ON v.Id=i.VariantId AND v.BusinessId=@BusinessId
     JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId
     WHERE m.ReferenceType='ORDER' AND i.OrderId=m.ReferenceId AND i.DeletedAt IS NULL
    ) names
   ) productNames ORDER BY m.At DESC,m.Id DESC,m.Source FOR JSON PATH),'[]')) Items
 FROM #Summary s FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardMoneySection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 DECLARE @AsOf datetime2=SYSUTCDATETIME();
 SELECT k.Name,COALESCE(SUM(m.Amount),0) Value INTO #Balances
 FROM (VALUES(1,'Cash','CASH'),(2,'bKash','BKASH'),(3,'Nagad','NAGAD')) k(Sort,Name,Source)
 LEFT JOIN dbo.CashFlowMovements(@BusinessId,@BranchId,@AsOf) m ON m.Source=k.Source GROUP BY k.Sort,k.Name;
 SELECT (SELECT SUM(Value) FROM #Balances) Total,CONVERT(varchar(33),@AsOf,126)+'Z' AsOf,
 JSON_QUERY((SELECT Name,Value FROM #Balances ORDER BY CASE Name WHEN 'Cash' THEN 1 WHEN 'bKash' THEN 2 ELSE 3 END FOR JSON PATH)) Rows
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END
