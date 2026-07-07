using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ResellerApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class Branch_BackfillExistingStaffUserBranches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing STAFF/WAREHOUSE users need an explicit UserBranch row to pass the
            // branch-access check going forward (OWNER/MANAGER don't need one — see
            // BusinessContextMiddleware). Assign each to their business's Main Branch.
            migrationBuilder.Sql(@"
                INSERT INTO user_branches (UserId, BranchId, IsDefault, CreatedAt)
                SELECT
                    u.Id,
                    br.Id,
                    1,
                    GETUTCDATE()
                FROM users u
                JOIN business_users bu ON bu.UserId = u.Id
                JOIN branches br ON br.BusinessId = bu.BusinessId AND br.IsDefault = 1
                WHERE u.Role IN ('STAFF', 'WAREHOUSE')
                  AND NOT EXISTS (
                      SELECT 1 FROM user_branches ub
                      WHERE ub.UserId = u.Id AND ub.BranchId = br.Id
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE ub FROM user_branches ub
                JOIN users u ON u.Id = ub.UserId
                WHERE u.Role IN ('STAFF', 'WAREHOUSE') AND ub.IsDefault = 1;
            ");
        }
    }
}
