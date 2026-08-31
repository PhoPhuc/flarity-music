import { useState, useEffect, useCallback } from 'react';
import {
  type AppUpdateInfo,
  checkForAppUpdate,
  CURRENT_APP_VERSION,
} from '../services/updateService';

export const useAppUpdater = () => {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState<boolean>(() => {
    return localStorage.getItem('flarity_auto_check_updates') !== 'false';
  });

  const check = useCallback(async (force = false) => {
    setIsChecking(true);
    try {
      const info = await checkForAppUpdate({ force });
      setUpdateInfo(info);
      if (info.hasUpdate) {
        setIsUpdateModalOpen(true);
      }
      return info;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const toggleAutoCheck = (enabled: boolean) => {
    setAutoCheckEnabled(enabled);
    localStorage.setItem('flarity_auto_check_updates', enabled ? 'true' : 'false');
  };

  useEffect(() => {
    if (autoCheckEnabled) {
      const timer = setTimeout(() => {
        check(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [autoCheckEnabled, check]);

  return {
    updateInfo,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    isChecking,
    checkNow: () => check(true),
    autoCheckEnabled,
    toggleAutoCheck,
    currentVersion: CURRENT_APP_VERSION,
  };
};