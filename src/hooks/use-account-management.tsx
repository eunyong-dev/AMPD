/**
 * 계정 관리 훅
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AccountProfile,
  getActiveUserProfiles,
  addAccount,
  getAllAccountProfiles,
  updateAccount,
  deleteAccount,
} from '@/lib/account-management';
import { UserProfile } from '@/lib/permissions';

export function useAccountManagement() {
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 계정 목록 로드
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accountProfiles = await getAllAccountProfiles();
      setAccounts(accountProfiles);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '계정을 불러올 수 없습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 활성 사용자 목록 로드
  const loadActiveUsers = useCallback(async () => {
    try {
      const userProfiles = await getActiveUserProfiles();
      setActiveUsers(userProfiles);
    } catch (err) {
      console.error('활성 사용자 로드 오류:', err);
    }
  }, []);

  // 새 계정 추가 — 회사명 중복(대소문자/공백 차이 무시) 차단
  const createAccount = useCallback(
    async (accountData: {
      company: string;
      country: string;
      assigned_user_id: string;
    }) => {
      try {
        const normalized = accountData.company.trim().toLowerCase();
        if (!normalized) {
          throw new Error('Company name is required.');
        }
        // 클라이언트 사전 체크 (DB unique constraint도 서버측 보호)
        const duplicate = accounts.some(
          (a) => a.company.trim().toLowerCase() === normalized
        );
        if (duplicate) {
          throw new Error(
            `An account with the company name "${accountData.company}" already exists.`
          );
        }

        const newAccount = await addAccount(accountData);
        setAccounts((prevAccounts) => [newAccount, ...prevAccounts]);
        return newAccount;
      } catch (err) {
        // Postgres unique violation (23505) 친화적 메시지
        const raw = err instanceof Error ? err.message : '';
        const friendly =
          /duplicate key|unique constraint|already exists/i.test(raw)
            ? `An account with the company name "${accountData.company}" already exists.`
            : raw || '계정을 생성할 수 없습니다.';
        setError(friendly);
        throw new Error(friendly);
      }
    },
    [accounts]
  );

  // 계정 업데이트
  const updateAccountData = useCallback(
    async (
      accountId: string,
      accountData: {
        company: string;
        country: string;
        assigned_user_id: string;
      }
    ) => {
      try {
        const updatedAccount = await updateAccount(accountId, accountData);
        setAccounts((prevAccounts) =>
          prevAccounts.map((account) =>
            account.id === accountId ? updatedAccount : account
          )
        );
        return updatedAccount;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '계정을 업데이트할 수 없습니다.'
        );
        throw err;
      }
    },
    []
  );

  // 계정 삭제
  const removeAccount = useCallback(async (accountId: string) => {
    try {
      await deleteAccount(accountId);
      setAccounts((prevAccounts) =>
        prevAccounts.filter((account) => account.id !== accountId)
      );
    } catch (err) {
      console.error('Delete account error:', err);
      setError(
        err instanceof Error ? err.message : '계정을 삭제할 수 없습니다.'
      );
      throw err;
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadAccounts(), loadActiveUsers()]);
    };

    loadData();
  }, [loadAccounts, loadActiveUsers]);

  // 반환값 메모이제이션
  return useMemo(
    () => ({
      accounts,
      activeUsers,
      loading,
      error,
      loadAccounts,
      createAccount,
      updateAccount: updateAccountData,
      removeAccount,
    }),
    [
      accounts,
      activeUsers,
      loading,
      error,
      loadAccounts,
      createAccount,
      updateAccountData,
      removeAccount,
    ]
  );
}
