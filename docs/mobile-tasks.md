# Mobile Tasks

The Expo app now includes **More → Tasks**, a compact Home widget, and persistent task notifications behind the header bell. The same screens render as desktop rows and phone cards. The shared .NET API implements persistence and authorization; no task data is mocked in application code.

## Access

The existing management roles are `OWNER`, `MANAGER`, and `PARTNER`. There is no separate management-member role or user directory. Active users in those roles, with membership in the selected business, can create and receive tasks. Tasks are business-wide across branches, matching the application's business tenancy boundary.

Managers and partners see tasks they created or are currently assigned. Owners retain the application's full administrative access. Owners can grant broader access in **Tasks → Permissions**:

| Permission | Effect |
| --- | --- |
| View all tasks | Enables All Tasks; does not grant editing or commenting on other users' tasks. |
| Comment on accessible tasks | Permits commenting on tasks accessible through View all tasks. |
| Manage all tasks | Includes viewing, commenting, editing, reassignment and status administration. |

Grants are stored on the existing business-user membership, default to false, and are checked from the database on every request. Inactive users cannot use the feature or receive new assignments. Their existing task history remains intact. A previous assignee immediately loses backend access unless they remain the creator or have broader access. Lists, counts, history and notification queries use the same current visibility rules.

## Workflow

- Required title and one active eligible assignee; optional description and due time; Normal or Urgent priority.
- To Do → In Progress → Done is controlled by the assignee, with movement back to To Do allowed while active. Completing can include one optional note recorded once in the timeline.
- Creators can edit/reassign active tasks, cancel them and reopen Done/Cancelled tasks. Reopening clears the current completion fields and preserves all history.
- Comments are append-only text, preserve line breaks, and do not change status. Failed submissions preserve the draft; concurrent task changes produce HTTP 409 and require refresh.
- Overdue is calculated for active dated tasks. Active ordering is overdue, urgent, earliest due date, oldest creation time, then ID. Summaries describe the selected view, independently of the list's search/status filters.
- All timestamps are stored in UTC. Task dates, including due-date history, are displayed in Asia/Dhaka, consistent with existing reports. Due-date input explicitly uses UTC+06:00.
- Task changes, timeline events, global audit records and notifications are written in one EF SaveChanges transaction. SQL Server rowversion protects task edits and comments against concurrent reassignment/update.
- Notification recipients exclude the actor and are deduplicated. Both listing and opening notifications recheck current task access. The bell and Home widget poll every 10 seconds; there are no sales-screen popups or external messages.

## Database and deployment

Migration: `20261001101943_AddWorkTasks`.

It adds `work_tasks`, `task_entries` (comments and history), `task_notifications`, their foreign keys/indexes/rowversion columns, and three permission flags on `business_users`. It does not reset or recreate any database or remove existing application data.

Deploy the backend and mobile build together. Against the intended configured database, use the normal EF migration workflow:

```powershell
dotnet ef database update 20261001101943_AddWorkTasks --project backend/src/ResellerApi
```

The existing backend also applies pending migrations automatically at startup. Review the database's pending migration list first: this workspace already contains an unrelated `PreOrderFreeTextItems` migration. The Tasks migration was generated after it and does not include those pre-order changes. No production database migration was executed during implementation.

To inspect just this migration's SQL:

```powershell
dotnet ef migrations script 20261001000000_PreOrderFreeTextItems 20261001101943_AddWorkTasks --project backend/src/ResellerApi --output AddWorkTasks.sql
```

No role seed, fixed user IDs or task seed data is required. Broader permissions are optional; configure them from the owner account after deploying.

## Verification

- Backend builds successfully.
- Seven `TaskServiceTests` pass, covering eligible roles/self assignment, visibility/counts/history, reassignment and previous-assignee notifications, separate view/comment/manage grants, cross-business and inactive-user rejection, status/reopen/completion history, persisted chronological comments, recipient deduplication, stale rowversions, sorting and UTC conversion.
- The normal backend test project currently fails to compile in existing `InvoiceListTests.cs`, where `OrderItem` and `OrderPayment` are initialized with nonexistent `BusinessId` properties. Task tests were run with that unrelated file excluded through a temporary MSBuild target; the source test file was not changed.
- Expo web export and a focused TypeScript check of the Tasks screens/routes pass. Full mobile typechecking reports existing errors in `OrderDetailScreen.tsx` and `OrdersScreen.tsx`; no Tasks errors were reported.
- Headless browser checks passed at desktop (1440px) and phone (390px) widths: list, creation form, detail view, required-field validation, comment draft preservation after a simulated 503, retry and comment rendering. No JavaScript exceptions or page overflow were observed. These UI tests used isolated API fixtures, not a live production connection; screenshots and the harness are in `.tmp/tasks/`.
- Tests use EF's InMemory provider. Actual SQL Server migration execution and simultaneous SQL Server transactions still need verification in the deployment environment. No signed APK or native-device test was performed.

## Manual check after deployment

1. Sign in as an owner, manager and partner. In More → Tasks, create tasks for each role and yourself, with and without due dates. Confirm staff cannot access the task API.
2. In a manager account, check My Tasks and Created by Me. Grant View all tasks from the owner account and verify All Tasks appears without edit/reassignment privileges on others' tasks.
3. Assign a task to another person. As that assignee, post a multiline note, refresh, start progress and complete with a note. Verify the creator gets the completion notification and the note appears only once.
4. Reopen, reassign and cancel/reopen the task as its creator. Verify earlier comments remain and the previous assignee loses detail/history/notification access.
5. Create overdue, urgent, future and undated tasks. Check list ordering and Home counts. Verify a completed overdue task loses its Overdue label.
6. Open one task in two sessions. Save a change in one, then submit from the stale session. Expect a conflict; refresh and verify no silent overwrite or duplicate comment.
7. Switch business and attempt another business's task ID and assignee ID. Expect rejection. Check the bell excludes notifications for tasks no longer accessible.
8. At phone and desktop widths, create/edit a task, read the timeline, write a long comment, test a failed save, and verify the draft remains available for retry.

Suggested commit message: `Add business-scoped mobile tasks, progress history and notifications`.
