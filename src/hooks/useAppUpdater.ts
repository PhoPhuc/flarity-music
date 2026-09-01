import { useState, useEffect, useCallback } from 'react';
import {
  type AppUpdateInfo,
  checkForAppUpdate,
  CURRENT_APP_VERSION,
} from '../services/updateService';

export const useAppUpdater = () => {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdateToastOpen, setIsUpdateToastOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState<boolean>(() => {
    return localStorage.getItem('flarity_auto_check_updates') !== 'false';
  });

  const check = useCallback(async (force = false, mode: 'auto' | 'manual' = 'auto') => {
    setIsChecking(true);
    try {
      const info = await checkForAppUpdate({ force });
      setUpdateInfo(info);
      if (info.hasUpdate) {
        if (mode === 'auto') {
          setIsUpdateToastOpen(true);
        } else {
          setIsUpdateModalOpen(true);
        }
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

  // Tự động kiểm tra bản cập nhật sau đúng 5 giây từ khi mở ứng dụng
  useEffect(() => {
    if (autoCheckEnabled) {
      const timer = setTimeout(() => {
        check(false, 'auto');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoCheckEnabled, check]);

  const openFullModal = () => {
    setIsUpdateToastOpen(false);
    setIsUpdateModalOpen(true);
  };

  return {
    updateInfo,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    isUpdateToastOpen,
    setIsUpdateToastOpen,
    openFullModal,
    isChecking,
    checkNow: () => check(true, 'manual'),
    autoCheckEnabled,
    toggleAutoCheck,
    currentVersion: CURRENT_APP_VERSION,
  };
};