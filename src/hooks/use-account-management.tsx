/**
 * 계정 관리 훅 (TanStack Query 기반)
 *
 * 동일한 반환 형태(accounts, activeUsers, loading, error, ...)를 유지해
 * 기존 호출자들과 호환됩니다.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AccountProfile,
  getActiveUserProfiles,
  addAccount,
  getAllAccountProfiles,
  updateAccount,
  deleteAccount,
} from '@/lib/account-management';

export const accountKeys = {
  all: ['accounts'] as const,
  list: () => [...accountKeys.all, 'list'] as const,
};

export const activeUserKeys = {
  all: ['active-users'] as const,
  list: () => [...activeUserKeys.all, 'list'] as const,
};

export function useAccountManagement() {
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: accountKeys.list(),
    queryFn: getAllAccountProfiles,
  });

  const activeUsersQuery = useQuery({
    queryKey: activeUserKeys.list(),
    queryFn: getActiveUserProfiles,
  });

  const accounts: AccountProfile[] = accountsQuery.data ?? [];
  const activeUsers = activeUsersQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: addAccount,
    onSuccess: (newAccount) => {
      queryClient.setQueryData<AccountProfile[]>(
        accountKeys.list(),
        (prev) => [newAccount, ...(prev ?? [])]
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: { company: string; country: string; assigned_user_id: string };
    }) => updateAccount(accountId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<AccountProfile[]>(
        accountKeys.list(),
        (prev) =>
          (prev ?? []).map((a) => (a.id === updated.id ? updated : a))
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: (_, accountId) => {
      queryClient.setQueryData<AccountProfile[]>(
        accountKeys.list(),
        (prev) => (prev ?? []).filter((a) => a.id !== accountId)
      );
    },
  });

  // 회사명 중복 사전 체크 후 생성
  const createAccountWithDupCheck = useCallback(
    async (accountData: {
      company: string;
      country: string;
      assigned_user_id: string;
    }) => {
      const normalized = accountData.company.trim().toLowerCase();
      if (!normalized) {
        throw new Error('Company name is required.');
      }
      const duplicate = accounts.some(
        (a) => a.company.trim().toLowerCase() === normalized
      );
      if (duplicate) {
        throw new Error(
          `An account with the company name "${accountData.company}" already exists.`
        );
      }
      try {
        return await createMutation.mutateAsync(accountData);
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        const friendly =
          /duplicate key|unique constraint|already exists/i.test(raw)
            ? `An account with the company name "${accountData.company}" already exists.`
            : raw || '계정을 생성할 수 없습니다.';
        throw new Error(friendly);
      }
    },
    [accounts, createMutation]
  );

  return useMemo(
    () => ({
      accounts,
      activeUsers,
      loading: accountsQuery.isLoading,
      error: accountsQuery.error?.message ?? null,
      loadAccounts: () => {
        queryClient.invalidateQueries({ queryKey: accountKeys.list() });
      },
      createAccount: createAccountWithDupCheck,
      updateAccount: async (
        accountId: string,
        data: { company: string; country: string; assigned_user_id: string }
      ) => updateMutation.mutateAsync({ accountId, data }),
      removeAccount: async (accountId: string) =>
        deleteMutation.mutateAsync(accountId),
    }),
    [
      accounts,
      activeUsers,
      accountsQuery.isLoading,
      accountsQuery.error,
      queryClient,
      createAccountWithDupCheck,
      updateMutation,
      deleteMutation,
    ]
  );
}
