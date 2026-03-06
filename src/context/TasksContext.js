/**
 * TasksContext - Global Tasks State Management
 * Manages tasks data and operations across the app
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { generateId } from '../utils/Helpers';
import { tasksAPI } from '../api';

// Dummy initial tasks data
const INITIAL_TASKS = [
  {
    id: '1',
    title: 'Follow up with John Smith',
    description: 'Discuss proposal details',
    type: 'call',
    priority: 'high',
    status: 'pending',
    dueDate: new Date(),
    leadId: '1',
    leadName: 'John Smith',
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    title: 'Send proposal to Sarah',
    description: 'Include pricing options',
    type: 'email',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date(Date.now() + 86400000),
    leadId: '2',
    leadName: 'Sarah Johnson',
    createdAt: new Date(Date.now() - 7200000),
  },
  {
    id: '3',
    title: 'Schedule demo with Mike',
    description: 'Product demonstration',
    type: 'meeting',
    priority: 'low',
    status: 'pending',
    dueDate: new Date(Date.now() + 172800000),
    leadId: '3',
    leadName: 'Mike Chen',
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: '4',
    title: 'Prepare contract for Emily',
    description: 'Final agreement',
    type: 'document',
    priority: 'high',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 259200000),
    leadId: '4',
    leadName: 'Emily Davis',
    createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: '5',
    title: 'Review requirements',
    description: 'Client requirements analysis',
    type: 'review',
    priority: 'medium',
    status: 'completed',
    dueDate: new Date(Date.now() - 86400000),
    leadId: '5',
    leadName: 'Robert Wilson',
    createdAt: new Date(Date.now() - 259200000),
  },
];

// Create the context
const TasksContext = createContext(null);

/**
 * TasksProvider Component
 */
export const TasksProvider = ({ children }) => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  /**
   * Get all tasks
   */
  const getTasks = useCallback(() => {
    return tasks;
  }, [tasks]);

  /**
   * Get task by ID
   */
  const getTaskById = useCallback(
    id => {
      return tasks.find(task => task.id === id);
    },
    [tasks],
  );

  /**
   * Add a new task
   */
  const addTask = useCallback(async taskData => {
    // Optimistic UI: insert local task immediately so Tasks page shows it
    const tempId = generateId();
    const newTask = {
      id: tempId,
      ...taskData,
      status: 'pending',
      createdAt: new Date(),
      _synced: false, // local flag to indicate not yet synced with backend
    };

    try {
      setIsLoading(true);

      // Add local task immediately
      setTasks(prev => [newTask, ...prev]);

      // Call API to create task on backend
      const resp = await tasksAPI.create(taskData);

      // If API succeeded, replace temp task with server task
      if (resp.success && resp.data) {
        // Server may return created task under resp.data or resp.data.task
        const serverTask = resp.data || resp.data?.task;

        // Normalize serverTask fields and ensure dates are proper
        const finalTask = {
          id:
            serverTask.id ||
            serverTask._id ||
            serverTask.taskId ||
            generateId(),
          ...taskData,
          ...serverTask,
          status: serverTask.status || 'pending',
          createdAt: serverTask.createdAt
            ? new Date(serverTask.createdAt)
            : new Date(),
          _synced: true,
        };

        // Replace temp task with finalTask
        setTasks(prev => prev.map(t => (t.id === tempId ? finalTask : t)));

        return { success: true, task: finalTask };
      }

      // If it's a network error, keep local task and mark offline (not synced)
      if (resp.isNetworkError) {
        // Leave the optimistic task in the list with _synced: false
        return { success: true, task: newTask, offline: true };
      }

      // Other server-side failure: remove optimistic task and report error
      setTasks(prev => prev.filter(t => t.id !== tempId));
      return { success: false, error: resp.error || 'Failed to create task' };
    } catch (error) {
      console.error('Error adding task:', error);
      // On unexpected error, keep optimistic task but mark unsynced
      setTasks(prev =>
        prev.map(t => (t.id === tempId ? { ...t, _synced: false } : t)),
      );
      return {
        success: true,
        task: { ...newTask, _synced: false },
        offline: true,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update an existing task
   */
  const updateTask = useCallback(async (id, updates) => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setTasks(prev =>
        prev.map(task =>
          task.id === id
            ? { ...task, ...updates, updatedAt: new Date() }
            : task,
        ),
      );

      return { success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      return { success: false, error: 'Failed to update task' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a task
   */
  const deleteTask = useCallback(async id => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      setTasks(prev => prev.filter(task => task.id !== id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      return { success: false, error: 'Failed to delete task' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggle task completion status
   */
  const toggleTaskStatus = useCallback(
    async id => {
      const task = tasks.find(t => t.id === id);
      if (!task) return { success: false, error: 'Task not found' };

      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      return await updateTask(id, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date() : null,
      });
    },
    [tasks, updateTask],
  );

  /**
   * Get tasks by status
   */
  const getTasksByStatus = useCallback(
    status => {
      if (status === 'all') return tasks;
      return tasks.filter(task => task.status === status);
    },
    [tasks],
  );

  /**
   * Get tasks by priority
   */
  const getTasksByPriority = useCallback(
    priority => {
      return tasks.filter(task => task.priority === priority);
    },
    [tasks],
  );

  /**
   * Get tasks for a specific lead
   */
  const getTasksByLead = useCallback(
    leadId => {
      return tasks.filter(task => task.leadId === leadId);
    },
    [tasks],
  );

  /**
   * Get overdue tasks
   */
  const getOverdueTasks = useCallback(() => {
    const now = new Date();
    return tasks.filter(
      task => task.status !== 'completed' && new Date(task.dueDate) < now,
    );
  }, [tasks]);

  /**
   * Get today's tasks
   */
  const getTodaysTasks = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter(task => {
      const dueDate = new Date(task.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    });
  }, [tasks]);

  /**
   * Get tasks statistics
   */
  const getTasksStats = useCallback(() => {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = getOverdueTasks().length;

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed,
      overdue,
    };
  }, [tasks, getOverdueTasks]);

  const value = {
    // State
    tasks,
    isLoading,
    selectedTask,
    setSelectedTask,

    // Methods
    getTasks,
    getTaskById,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    getTasksByStatus,
    getTasksByPriority,
    getTasksByLead,
    getOverdueTasks,
    getTodaysTasks,
    getTasksStats,
  };

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  );
};

/**
 * useTasks Hook
 */
export const useTasks = () => {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
};

export default TasksContext;
