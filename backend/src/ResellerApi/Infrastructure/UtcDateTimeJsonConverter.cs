using System.Text.Json;
using System.Text.Json.Serialization;

namespace ResellerApi.Infrastructure;

// All DateTimes are stored as UTC, but SQL Server returns them with Kind=Unspecified, so they were
// sent without "Z" and apps showed them as local time (6 hours off). Always write UTC with "Z".
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetDateTime();
        return value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value;
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            _ => value
        };
        writer.WriteStringValue(utc);
    }
}
