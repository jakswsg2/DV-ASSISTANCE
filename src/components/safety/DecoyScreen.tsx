/**
 * Decoy Screen Component
 * DV-Assistance Platform - Safety Core
 *
 * Internal benign neutral screen activated by Quick Escape.
 * Contains purely generic utility content (daily task list & scratchpad)
 * with zero crisis, survivor, or sensitive domain data.
 */

import React, { useState } from 'react';
import { useSafety } from '../../safety/SafetyContext.tsx';

interface TaskItem {
  id: number;
  text: string;
  done: boolean;
}

export const DecoyScreen: React.FC = () => {
  const { toggleDecoy } = useSafety();
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: 1, text: 'Review grocery list and pantry items', done: true },
    { id: 2, text: 'Confirm schedule for team sync', done: false },
    { id: 3, text: 'Order replacement water filter', done: false },
    { id: 4, text: 'Check community center schedule', done: false },
  ]);
  const [newTaskText, setNewTaskText] = useState('');
  const [notes, setNotes] = useState('Meeting notes:\n- Follow up on utility bill\n- Schedule dentist appointment');

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks((prev) => [...prev, { id: Date.now(), text: newTaskText.trim(), done: false }]);
    setNewTaskText('');
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 p-4 sm:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Neutral Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-neutral-300 pb-4 gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
              Daily Tasks & Notes
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              Personal checklist and scratchpad
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400">
              Local Scratchpad
            </span>
            {/* Discreet button allowing return to app during development/testing */}
            <button
              type="button"
              onClick={() => toggleDecoy(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600 underline focus:outline-none focus:ring-1 focus:ring-neutral-400 rounded px-1"
              title="Return to platform view"
              aria-label="Return to platform view"
            >
              Resume Workspace
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Task Checklist */}
          <section className="bg-white rounded-lg border border-neutral-200 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-medium text-neutral-900">Action Items</h2>
            <form onSubmit={addTask} className="flex gap-2">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Add a quick task..."
                className="flex-1 text-sm border border-neutral-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-500 bg-neutral-50"
              />
              <button
                type="submit"
                className="text-sm bg-neutral-800 text-white px-3 py-1.5 rounded hover:bg-neutral-700 focus:outline-none"
              >
                Add
              </button>
            </form>
            <ul className="space-y-2 pt-2">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    id={`task-${task.id}`}
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    className="rounded border-neutral-300 text-neutral-700 focus:ring-0"
                  />
                  <label
                    htmlFor={`task-${task.id}`}
                    className={`${task.done ? 'line-through text-neutral-400' : 'text-neutral-700'}`}
                  >
                    {task.text}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {/* Quick Scratchpad */}
          <section className="bg-white rounded-lg border border-neutral-200 p-5 shadow-xs space-y-4">
            <h2 className="text-base font-medium text-neutral-900">Quick Notes</h2>
            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm font-mono border border-neutral-300 rounded p-3 focus:outline-none focus:ring-1 focus:ring-neutral-500 bg-neutral-50 resize-none"
              placeholder="Type temporary notes here..."
            />
            <p className="text-xs text-neutral-400">
              Scratchpad entries remain local to this browser view.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DecoyScreen;
