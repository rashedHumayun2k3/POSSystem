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
 AND c.PaymentMethod='CASH' AND c.AmountPaisa<>0 AND c.InjectedAt<@End
 UNION ALL
 -- Partner withdrawals (no approval step) take money out of shop cash. Business-wide, like capital.
 SELECT w.Id,w.PartnerId,'WITHDRAW','WITHDRAWAL','CASH',w.RequestedAt,-CAST(w.AmountPaisa AS decimal(18,2))/100,CAST(pa.Name AS nvarchar(150))
 FROM dbo.withdrawal_requests w JOIN dbo.partners pa ON pa.Id=w.PartnerId
 WHERE w.BusinessId=@BusinessId AND w.DeletedAt IS NULL AND w.Status='APPROVED' AND w.RequestedAt<@End;
