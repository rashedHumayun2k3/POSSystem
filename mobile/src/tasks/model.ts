export type TaskPermissions = { canCreate: boolean; canViewAll: boolean; canCommentAll: boolean; canManageAll: boolean; canConfigure: boolean };
export type TaskItem = {
  id: string; title: string; description: string | null; creatorId: string; creator: string; assigneeId: string; assignee: string;
  createdAt: string; updatedAt: string; dueAt: string | null; priority: string; status: string; overdue: boolean;
  completedBy: string | null; completedAt: string | null; rowVer: string;
  canEdit: boolean; canChangeStatus: boolean; canReopen: boolean; canComment: boolean;
};
export type TaskList = { items: TaskItem[]; total: number; page: number; pageSize: number; counts: { pending: number; overdue: number; done: number }; permissions: TaskPermissions };
export type Assignee = { id: string; name: string; role: string };
export type Entry = { id: string; kind: string; message: string; author: string; createdAt: string };
export type NotificationList = { unread: number; total: number; items: { id: string; taskId: string; message: string; createdAt: string; readAt: string | null }[] };
export const eligible = (role?: string) => ["OWNER", "MANAGER", "PARTNER"].includes(role ?? "");
export const statusLabel = (value: string) => ({ TODO: "To Do", IN_PROGRESS: "In Progress", DONE: "Done", CANCELLED: "Cancelled", ACTIVE: "All Active" }[value] ?? value);
export const taskTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(value)) : "No due date";
export const dueField = (value: string | null) => value ? new Date(new Date(value).getTime() + 6 * 3600000).toISOString().slice(0, 16) : "";
