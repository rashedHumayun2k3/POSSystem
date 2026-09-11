using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Branch_SeedMainBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seed one default "Main Branch" for every existing business.
            migrationBuilder.Sql(@"
                INSERT INTO branches (Id, BusinessId, Name, Code, Address, Phone, IsActive, IsDefault, CreatedAt, UpdatedAt)
                SELECT
                    NEWID(),
                    b.Id,
                    N'Main Branch',
                    N'MAIN',
                    NULL,
                    NULL,
                    1,
                    1,
                    GETUTCDATE(),
                    GETUTCDATE()
                FROM businesses b
                WHERE b.DeletedAt IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM branches br
                      WHERE br.BusinessId = b.Id
                        AND br.IsDefault = 1
                        AND br.DeletedAt IS NULL
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM branches WHERE Code = N'MAIN' AND IsDefault = 1;
            ");
        }
    }
}
