using System.Data;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ResellerApi.DTOs.Reports;
namespace ResellerApi.Services;
public partial class ReportService
{
 public async Task<CashActivityReport> GetCashActivityAsync(DateOnly from,DateOnly to,string source,string direction,int page)
 {
  if(from>to || to.DayNumber-from.DayNumber>365 || to>DateOnly.FromDateTime(DateTime.UtcNow.AddHours(6)) || from.Year<1900
   || source is not ("ALL" or "CASH" or "BKASH" or "NAGAD" or "CARD") || direction is not ("ALL" or "IN" or "OUT") || page<1 || page>1000000)
   throw new ArgumentException("Choose a valid date range of up to 366 days, source and transaction type.");
  if(_db.CurrentBusinessId==Guid.Empty)throw new InvalidOperationException("A business must be selected.");
  var connection=_db.Database.GetDbConnection();var opened=connection.State!=ConnectionState.Open;
  try{
   if(opened)await connection.OpenAsync();
   await using var command=connection.CreateCommand();command.CommandText="dbo.CashActivityReport";command.CommandType=CommandType.StoredProcedure;
   command.CommandTimeout=_db.Database.GetCommandTimeout()??30;
   void Add(string name,DbType type,object? value){var p=command.CreateParameter();p.ParameterName=name;p.DbType=type;p.Value=value??DBNull.Value;command.Parameters.Add(p);}
   Add("@BusinessId",DbType.Guid,_db.CurrentBusinessId);Add("@BranchId",DbType.Guid,_db.CurrentBranchId);
   Add("@From",DbType.Date,from.ToDateTime(TimeOnly.MinValue));Add("@To",DbType.Date,to.ToDateTime(TimeOnly.MinValue));
   Add("@Source",DbType.String,source);Add("@Direction",DbType.String,direction);Add("@Page",DbType.Int32,page);
   await using var reader=await command.ExecuteReaderAsync();var json=new StringBuilder();while(await reader.ReadAsync())json.Append(reader.GetString(0));
   return JsonSerializer.Deserialize<CashActivityReport>(json.ToString())??throw new InvalidOperationException("Missing cash activity result.");
  }finally{if(opened)await connection.CloseAsync();}
 }
}
