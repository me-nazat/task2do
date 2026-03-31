'use client';

import { useEffect } from 'react';
import { getLists } from '@/actions/list';
import { getTasks } from '@/actions/task';
import { createDemoLists, createDemoTasks, DEMO_TASK2DO_USER } from '@/lib/demo/task2do-data';
import { List, Task, useStore } from '@/store/useStore';

export function Task2DoBootstrap() {
  const {
    user,
    isAuthReady,
    tasks,
    lists,
    setUser,
    setTasks,
    setLists,
    setDemoMode,
  } = useStore();

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    let isMounted = true;

    if (!user) {
      setDemoMode(true);
      setUser(DEMO_TASK2DO_USER);
      if (tasks.length === 0) {
        setTasks(createDemoTasks());
      }
      if (lists.length === 0) {
        setLists(createDemoLists());
      }
      return;
    }

    if (user.id === DEMO_TASK2DO_USER.id) {
      setDemoMode(true);
      return;
    }

    setDemoMode(false);

    if (tasks.length === 0) {
      getTasks(user.id).then((result) => {
        if (!isMounted || !result.ok) {
          return;
        }

        setTasks(result.data as Task[]);
      });
    }

    if (lists.length === 0) {
      getLists(user.id).then((result) => {
        if (!isMounted || !result.ok) {
          return;
        }

        setLists(result.data as List[]);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthReady, lists.length, setDemoMode, setLists, setTasks, setUser, tasks.length, user]);

  return null;
}
