'use client';

import { useEffect } from 'react';
import { getPocketTrackerWorkspace } from '@/actions/pocket-tracker';
import { DEMO_TASK2DO_USER } from '@/lib/demo/task2do-data';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useStore } from '@/store/useStore';

export function PocketTrackerBootstrap() {
  const { user, isAuthReady, setUser, setDemoMode } = useStore();
  const { hasLoadedWorkspace, workspaceOwnerId, isWorkspaceLoading, setWorkspaceLoading, loadWorkspace } = useFinanceStore();

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    const activeUser = user ?? DEMO_TASK2DO_USER;

    if (!user) {
      setUser(DEMO_TASK2DO_USER);
      setDemoMode(true);
    }

    if (hasLoadedWorkspace && workspaceOwnerId === activeUser.id) {
      return;
    }

    if (isWorkspaceLoading) {
      return;
    }

    let isMounted = true;
    setWorkspaceLoading(true);

    getPocketTrackerWorkspace({
      userId: activeUser.id,
      email: activeUser.email,
      name: activeUser.displayName,
    }).then((result) => {
      if (!isMounted) {
        return;
      }

      if (!result.ok) {
        console.error('Unable to load Pocket Tracker workspace', result.error);
        setWorkspaceLoading(false);
        return;
      }

      loadWorkspace(activeUser.id, result.data);
    });

    return () => {
      isMounted = false;
    };
  }, [
    hasLoadedWorkspace,
    isAuthReady,
    isWorkspaceLoading,
    loadWorkspace,
    setDemoMode,
    setUser,
    setWorkspaceLoading,
    user,
    workspaceOwnerId,
  ]);

  return null;
}
