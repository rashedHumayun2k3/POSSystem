'use client';

import { PlusIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { PosSession } from '@/types/pos';

interface Props {
  sessions: PosSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDiscard: (id: string) => void;
  canAddMore: boolean;
}

const STATUS_DOT: Record<string, string> = {
  SCANNING: 'bg-green-500',
  AWAITING_PAYMENT: 'bg-amber-400',
  PROCESSING: 'bg-blue-500',
};

const STATUS_LABEL: Record<string, string> = {
  SCANNING: 'Scanning',
  AWAITING_PAYMENT: 'Awaiting payment',
  PROCESSING: 'Processing…',
};

function sessionTotal(s: PosSession): number {
  return s.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
}

// ── Mobile chip ───────────────────────────────────────────────────────────────
function Chip({
  session, active, onSelect, onDiscard,
}: {
  session: PosSession; active: boolean; onSelect: () => void; onDiscard: () => void;
}) {
  const total = sessionTotal(session);
  return (
    <div className={`flex-shrink-0 flex items-center rounded-full border text-xs font-medium transition-all ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
        : 'bg-white text-gray-700 border-gray-200'
    }`}>
      <button
        onClick={onSelect}
        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[session.status]}`} />
        <span className="font-bold">{session.label}</span>
        {session.items.length > 0 && (
          <span className={active ? 'text-indigo-200' : 'text-gray-400'}>
            {session.items.length}&nbsp;·&nbsp;৳{total.toLocaleString()}
          </span>
        )}
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDiscard(); }}
        className={`pr-2 pl-0.5 py-1.5 transition-colors ${
          active ? 'text-indigo-300 hover:text-white' : 'text-gray-300 hover:text-red-400'
        }`}
        title="Discard session"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Tablet sidebar card ───────────────────────────────────────────────────────
function SideCard({
  session, active, onSelect, onDiscard,
}: {
  session: PosSession; active: boolean; onSelect: () => void; onDiscard: () => void;
}) {
  const total = sessionTotal(session);
  return (
    <div className={`w-full rounded-xl border transition-all mb-2 ${
      active ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-100 hover:border-gray-200'
    }`}>
      <button onClick={onSelect} className="w-full text-left p-3 pb-2">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[session.status]}`} />
            <span className="font-bold text-sm text-gray-900">{session.label}</span>
            {session.customerName && (
              <span className="text-xs text-indigo-600 truncate max-w-[60px]">{session.customerName}</span>
            )}
          </div>
          <span className="text-xs font-semibold text-gray-900">৳{total.toLocaleString()}</span>
        </div>
        <div className="text-xs text-gray-400">
          {session.items.length === 0
            ? 'Empty cart'
            : `${session.items.length} item${session.items.length !== 1 ? 's' : ''}`}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{STATUS_LABEL[session.status]}</div>
      </button>
      <button
        onClick={onDiscard}
        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-b-xl transition-colors border-t border-gray-100"
      >
        <TrashIcon className="w-3 h-3" />
        Discard session
      </button>
    </div>
  );
}

export default function SessionTray({ sessions, activeId, onSelect, onNew, onDiscard, canAddMore }: Props) {
  return (
    <>
      {/* Mobile: horizontal scrollable chips — full width, shrinks to its height */}
      <div className="md:hidden w-full shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar border-b border-gray-100 bg-gray-50">
        {sessions.map(s => (
          <Chip
            key={s.id}
            session={s}
            active={s.id === activeId}
            onSelect={() => onSelect(s.id)}
            onDiscard={() => onDiscard(s.id)}
          />
        ))}
        {canAddMore && (
          <button
            onClick={onNew}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      {/* Tablet (md+): left sidebar */}
      <div className="hidden md:flex flex-col w-52 shrink-0 border-r border-gray-100 bg-gray-50 p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sessions</span>
          {canAddMore && (
            <button
              onClick={onNew}
              className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-700"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center mt-8">No active sessions</p>
        ) : (
          sessions.map(s => (
            <SideCard
              key={s.id}
              session={s}
              active={s.id === activeId}
              onSelect={() => onSelect(s.id)}
              onDiscard={() => onDiscard(s.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
