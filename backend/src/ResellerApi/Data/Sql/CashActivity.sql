CREATE OR ALTER PROCEDURE dbo.CashActivityReport
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL,
 @From date, @To date, @Source varchar(10)='CASH', @Direction varchar(3)='ALL', @Page int=1
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @From IS NULL OR @To IS NULL OR @From>@To OR DATEDIFF(day,@From,@To)>365 OR @Page<1 OR @Page>1000000
    OR @Source NOT IN ('ALL','CASH','BKASH','NAGAD') OR @Direction NOT IN ('ALL','IN','OUT')
    THROW 51000,'Invalid cash report filters.',1;
 DECLARE @AsOf datetime2=SYSUTCDATETIME(), @Start datetime2=DATEADD(hour,-6,CAST(@From AS datetime2)),
  @End datetime2=DATEADD(hour,-6,DATEADD(day,1,CAST(@To AS datetime2)));
 -- Signed payment amounts already include refunds. Never join order lines into the ledger grain.
 SELECT p.Id, p.OrderId ReferenceId, CAST('ORDER' AS varchar(10)) ReferenceType,
  CAST(CASE WHEN p.Amount<0 THEN 'REFUND' ELSE 'PAYMENT' END AS varchar(10)) Kind,
  REPLACE(p.Method,'REFUND_','') Source,p.ReceivedAt At,p.Amount,CAST(o.OrderNo AS nvarchar(150)) Title
 INTO #Movements
 FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
 AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL AND p.Amount<>0
 AND p.Method IN ('CASH','BKASH','NAGAD','REFUND_CASH','REFUND_BKASH','REFUND_NAGAD')
 AND p.ReceivedAt<@End AND p.ReceivedAt<=@AsOf
 AND (@Source='ALL' OR REPLACE(p.Method,'REFUND_','')=@Source);
 INSERT #Movements
 SELECT e.Id,e.Id,'EXPENSE','EXPENSE',v.Source,e.PaidAt,-v.Amount,COALESCE(NULLIF(e.Title,''),NULLIF(e.SubType,''),N'Expense')
 FROM dbo.expenses e CROSS APPLY(VALUES('CASH',e.CashAmount),('BKASH',e.BkashAmount),('NAGAD',e.NagadAmount))v(Source,Amount)
 WHERE e.BusinessId=@BusinessId AND (@BranchId IS NULL OR e.BranchId=@BranchId)
 AND e.DeletedAt IS NULL AND e.Status='APPROVED' AND e.FundingSource='CASH'
 AND e.PaidAt IS NOT NULL AND e.PaidAt<@End AND e.PaidAt<=@AsOf AND v.Amount<>0
 AND (@Source='ALL' OR v.Source=@Source);
 SELECT COALESCE(SUM(CASE WHEN At<@Start THEN Amount ELSE 0 END),0) Opening,
  COALESCE(SUM(CASE WHEN At>=@Start AND Amount>0 THEN Amount ELSE 0 END),0) MoneyIn,
  COALESCE(SUM(CASE WHEN At>=@Start AND Amount<0 THEN -Amount ELSE 0 END),0) MoneyOut,
  COALESCE(SUM(Amount),0) Closing,
  COUNT(CASE WHEN At>=@Start THEN 1 END) AllCount,
  COUNT(CASE WHEN At>=@Start AND Amount>0 THEN 1 END) InCount,
  COUNT(CASE WHEN At>=@Start AND Amount<0 THEN 1 END) OutCount
 INTO #Summary FROM #Movements;
 SELECT * INTO #Page FROM #Movements WHERE At>=@Start
 AND (@Direction='ALL' OR (@Direction='IN' AND Amount>0) OR (@Direction='OUT' AND Amount<0))
 ORDER BY At DESC,Id DESC,Source OFFSET (@Page-1)*50 ROWS FETCH NEXT 50 ROWS ONLY;
 SELECT CONVERT(varchar(10),@From,23) [From],CONVERT(varchar(10),@To,23) [To],
  CONVERT(varchar(33),@AsOf,126)+'Z' AsOf,@Source Source,@Direction Direction,@Page Page,50 PageSize,
  s.Opening,s.MoneyIn,s.MoneyOut,s.Closing,s.AllCount,s.InCount,s.OutCount,
  CASE @Direction WHEN 'IN' THEN s.InCount WHEN 'OUT' THEN s.OutCount ELSE s.AllCount END TotalItems,
  JSON_QUERY((SELECT m.Id,m.ReferenceId,m.ReferenceType,m.Kind,m.Source,m.Amount,m.Title,
   CONVERT(varchar(33),m.At,126)+'Z' At,CONVERT(varchar(10),DATEADD(hour,6,m.At),23) [Date],
   productNames.FirstProduct,COALESCE(productNames.ProductCount,0) ProductCount
   FROM #Page m OUTER APPLY(
    SELECT MIN(names.Name) FirstProduct,COUNT(*) ProductCount FROM (
     SELECT DISTINCT p.Id,p.Name FROM dbo.order_items i
     JOIN dbo.product_variants v ON v.Id=i.VariantId AND v.BusinessId=@BusinessId
     JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId
     WHERE m.ReferenceType='ORDER' AND i.OrderId=m.ReferenceId AND i.DeletedAt IS NULL
    ) names
   ) productNames ORDER BY m.At DESC,m.Id DESC,m.Source FOR JSON PATH)) Items
 FROM #Summary s FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END
