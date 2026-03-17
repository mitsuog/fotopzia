'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Check, Diamond, GripVertical } from 'lucide-react'
import type { WBSNode, WBSLevel } from '@/types/wbs'
import type { TeamProfile } from '@/hooks/useProject'
import { ProjectProgressRing } from './ProjectProgressRing'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Hecho',
  blocked: 'Bloqueado',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  medium: '#1C2B4A',
  high: '#f59e0b',
  urgent: '#ef4444',
}

const LEVEL_INDENT: Record<WBSLevel, number> = {
  macro: 0,
  activity: 20,
  task: 40,
}

const LEVEL_LABELS: Record<WBSLevel, string> = {
  macro: 'Macro',
  activity: 'Actividad',
  task: 'Tarea',
}

interface WBSNodeRowProps {
  node: WBSNode
  progress: number
  profiles: TeamProfile[]
  isExpanded: boolean
  hasChildren: boolean
  onToggleExpand: () => void
  onUpdate: (updates: Partial<WBSNode>) => Promise<unknown>
  onDelete: () => Promise<unknown>
  onOpen: () => void
  onAddChild: (level: WBSLevel) => void
}

export function WBSNodeRow({
  node,
  progress,
  profiles,
  isExpanded,
  hasChildren,
  onToggleExpand,
  onUpdate,
  onDelete,
  onOpen,
  onAddChild,
}: WBSNodeRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(node.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const indent = LEVEL_INDENT[node.level]
  const assignee = profiles.find(p => p.id === node.assigned_to)

  useEffect(() => {
    if (editingTitle && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  async function handleTitleBlur() {
    setEditingTitle(false)
    if (titleValue.trim() && titleValue.trim() !== node.title) {
      await onUpdate({ title: titleValue.trim() })
    } else {
      setTitleValue(node.title)
    }
  }

  async function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (node.level !== 'task') return
    const next = node.status === 'done' ? 'pending' : 'done'
    await onUpdate({ status: next })
  }

  const levelBorderColor = node.level === 'macro'
    ? 'border-l-brand-navy'
    : node.level === 'activity'
      ? 'border-l-brand-gold'
      : 'border-l-transparent'

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border-l-2 py-1.5 pr-2 transition-colors hover:bg-brand-canvas/60 ${levelBorderColor}`}
      style={{ paddingLeft: `${indent + 8}px` }}
    >
      {/* Drag handle (visual only for now) */}
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-300 opacity-0 group-hover:opacity-100" />

      {/* Expand toggle */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-navy/50 hover:text-brand-navy"
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <span className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Status checkbox / milestone icon */}
      {node.is_milestone ? (
        <Diamond className="h-4 w-4 shrink-0 text-brand-gold" />
      ) : node.level === 'task' ? (
        <button
          type="button"
          onClick={handleStatusClick}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            node.status === 'done'
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-gray-300 hover:border-brand-navy'
          }`}
        >
          {node.status === 'done' && <Check className="h-3 w-3" />}
        </button>
      ) : (
        <ProjectProgressRing progress={progress} size={20} strokeWidth={2.5} className="shrink-0" />
      )}

      {/* Priority indicator */}
      <div
        className="h-3 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLORS[node.priority] }}
        title={node.priority}
      />

      {/* Title */}
      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <input
            ref={inputRef}
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') inputRef.current?.blur()
              if (e.key === 'Escape') { setTitleValue(node.title); setEditingTitle(false) }
            }}
            className="w-full rounded border border-brand-gold/60 bg-white px-1.5 py-0.5 text-sm text-brand-navy outline-none"
          />
        ) : (
          <span
            className={`block cursor-pointer truncate text-sm ${
              node.level === 'macro' ? 'font-semibold text-brand-navy' :
              node.level === 'activity' ? 'font-medium text-brand-navy' :
              node.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700'
            }`}
            onDoubleClick={() => setEditingTitle(true)}
            onClick={onOpen}
          >
            {node.title}
          </span>
        )}
      </div>

      {/* Assignee avatar */}
      {assignee && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: profileColor(assignee.id) }}
          title={assignee.full_name ?? ''}
        >
          {(assignee.full_name ?? '?').charAt(0).toUpperCase()}
        </span>
      )}

      {/* Status badge (hide for task-level — uses checkbox instead) */}
      {node.level !== 'task' && (
        <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex ${STATUS_COLORS[node.status]}`}>
          {STATUS_LABELS[node.status]}
        </span>
      )}

      {/* Due date */}
      {node.due_at && (
        <span className={`hidden shrink-0 text-xs sm:block ${isOverdue(node) ? 'text-red-600' : 'text-gray-500'}`}>
          {formatDueDate(node.due_at)}
        </span>
      )}

      {/* Action menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-navy"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-6 z-50 min-w-[160px] rounded-lg border border-brand-stone bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onOpen() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-brand-navy hover:bg-brand-canvas"
            >
              Abrir detalle
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setEditingTitle(true) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-brand-navy hover:bg-brand-canvas"
            >
              Renombrar
            </button>
            {node.level !== 'task' && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onAddChild(node.level === 'macro' ? 'activity' : 'task')
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-brand-navy hover:bg-brand-canvas"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar {node.level === 'macro' ? 'actividad' : 'tarea'}
              </button>
            )}
            <div className="mx-3 my-1 border-t border-brand-stone" />
            <button
              type="button"
              onClick={() => { setMenuOpen(false); void onDelete() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function profileColor(id: string): string {
  const colors = ['#1C2B4A', '#2E3F5E', '#C49A2A', '#0f766e', '#7c3aed', '#b45309', '#0369a1']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

function isOverdue(node: WBSNode): boolean {
  if (!node.due_at || node.status === 'done') return false
  return new Date(node.due_at) < new Date()
}

function formatDueDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}
