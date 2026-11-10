CREATE OR ALTER PROCEDURE dbo.DashboardSalesSection
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Period varchar(12) = 'TODAY', @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH') THROW 51000, 'Invalid sales period.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
    DECLARE @Last date=CASE WHEN @Period='YESTERDAY' THEN DATEADD(day,-1,@Today) ELSE @Today END;
    DECLARE @First date=CASE WHEN @Period='7D' THEN DATEADD(day,-6,@Today)
        WHEN @Period='MONTH' THEN DATEFROMPARTS(YEAR(@Today),MONTH(@Today),1) ELSE @Last END;
    DECLARE @Hourly bit=CASE WHEN @Period IN ('TODAY','YESTERDAY') THEN 1 ELSE 0 END;
    DECLARE @Length int=DATEDIFF(day,@First,@Last)+1;
    DECLARE @PreviousFirst date=DATEADD(day,-@Length,@First);
    DECLARE @Start datetime2=DATEADD(hour,-6,CAST(@PreviousFirst AS datetime2));
    DECLARE @End datetime2=DATEADD(hour,-6,CAST(DATEADD(day,1,@Last) AS datetime2));
    SELECT CONVERT(date,DATEADD(hour,6,a.CreatedAt)) Day, DATEPART(hour,DATEADD(hour,6,a.CreatedAt)) Hour,
        a.Revenue,a.Cogs,a.Units,
        CASE WHEN o.Source='POS' THEN 'OFFLINE'
          WHEN o.Source IN ('CLIENTPAGE','EXTERNAL_WEBSITE') OR o.Channel IN ('FACEBOOK','WHATSAPP','INSTAGRAM','MYWEBSITE') THEN 'ONLINE'
          ELSE 'OFFLINE' END Channel
    INTO #Sales FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) a
    JOIN dbo.orders o ON o.Id=a.Id
    WHERE a.CreatedAt>=@Start AND a.CreatedAt<@End AND a.OrderStatus<>'CANCELLED';
    DECLARE @Sales decimal(28,5),@Profit decimal(28,5),@Orders int,@Units decimal(28,5),@Previous decimal(28,5);
    SELECT @Sales=COALESCE(SUM(Revenue),0),@Profit=COALESCE(SUM(Revenue-Cogs),0),@Orders=COUNT(*),@Units=COALESCE(SUM(Units),0)
    FROM #Sales WHERE Day>=@First;
    SELECT @Previous=COALESCE(SUM(Revenue),0) FROM #Sales WHERE Day<@First;
    SELECT @Sales Sales, CASE WHEN @CanSeeCosts=1 THEN @Profit END Profit, @Orders Orders,@Units ItemsSold,
        CASE WHEN @Orders>0 THEN ROUND(@Sales/@Orders,2) ELSE 0 END AverageBill,
        CASE WHEN @CanSeeCosts=1 AND @Sales<>0 THEN ROUND(@Profit/@Sales*100,1) END Margin,
        CASE WHEN @Previous>0 THEN ROUND((@Sales-@Previous)/@Previous*100,1) WHEN @Sales=0 THEN 0 END ChangePercent;
    ;WITH Numbers AS (SELECT 0 n UNION ALL SELECT n+1 FROM Numbers WHERE n<30)
    SELECT CASE WHEN @Hourly=1 THEN RIGHT('0'+CAST(n AS varchar(2)),2)+':00'
        ELSE CONVERT(varchar(10),DATEADD(day,n,@First),23) END Label,COALESCE(SUM(s.Revenue),0) Value
    FROM Numbers LEFT JOIN #Sales s ON s.Day>=@First AND
        ((@Hourly=1 AND s.Hour=n) OR (@Hourly=0 AND s.Day=DATEADD(day,n,@First)))
    WHERE n<CASE WHEN @Hourly=1 THEN 24 ELSE @Length END GROUP BY n ORDER BY n;
    SELECT c.Channel,COUNT(s.Channel) Orders,COALESCE(SUM(s.Revenue),0) Sales,
        CASE WHEN @Sales<>0 THEN ROUND(COALESCE(SUM(s.Revenue),0)/@Sales*100,1) ELSE 0 END Share
    FROM (VALUES('ONLINE'),('OFFLINE')) c(Channel)
    LEFT JOIN #Sales s ON s.Channel=c.Channel AND s.Day>=@First GROUP BY c.Channel ORDER BY c.Channel DESC;
END
