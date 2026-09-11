// Shared between the expense entry form (expenses/new) and the financial report's
// category breakdown — one place so a new category's icon doesn't drift between screens.
export const EXPENSE_CATEGORY_ICONS: Record<string, string> = {
  OFFICE:          '🖥️',
  STAFF:           '👤',
  MARKETING:       '📣',
  DELIVERY:        '🚚',
  TRIP:            '✈️',
  EQUIPMENT_OTHER: '🔧',
  OWNER_DRAWING:   '💸',
  INVENTORY_LOSS:  '📉',
  SETUP_CAPEX:     '🏗️',
};
