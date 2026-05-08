/**
 * 사용자 관리 TanStack Query 훅
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserProfile, UserRole } from '@/lib/permissions';
import {
  getAllUserProfiles,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  addUser,
  updateUserManagerNo,
} from '@/lib/user-management';

// Query Keys
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) =>
    [...userKeys.lists(), { filters }] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

/**
 * 사용자 목록을 가져오는 Query
 */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: getAllUserProfiles,
    staleTime: 1000 * 60 * 2, // 2분 동안 캐시 유지
    gcTime: 1000 * 60 * 5, // 5분 동안 가비지 컬렉션 방지
  });
}

/**
 * 사용자 역할 업데이트 Mutation
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: UserRole }) =>
      updateUserRole(userId, newRole),
    onSuccess: () => {
      // 사용자 목록 캐시 무효화하여 자동 리페치
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * 사용자 활성화/비활성화 Mutation
 */
export function useToggleUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      toggleUserActive(userId, isActive),
    onSuccess: () => {
      // 사용자 목록 캐시 무효화하여 자동 리페치
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * 사용자 삭제 Mutation
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      // 사용자 목록 캐시 무효화하여 자동 리페치
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * 사용자 담당자 번호 업데이트 Mutation
 */
export function useUpdateUserManagerNo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      managerNo,
    }: {
      userId: string;
      managerNo: string | null;
    }) => updateUserManagerNo(userId, managerNo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * 사용자 생성 Mutation
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: {
      email: string;
      display_name: string;
      role: UserRole;
    }) => addUser(userData),
    onSuccess: () => {
      // 사용자 목록 캐시 무효화하여 자동 리페치
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * 기존 useUserManagement와 동일한 인터페이스를 유지하는 레거시 호환 훅
 * @deprecated useUsers, useUpdateUserRole, useToggleUserActive 등을 직접 사용하는 것을 권장합니다
 */
export function useUserManagement() {
  const { data: users = [], isLoading: loading, error } = useUsers();
  const updateRoleMutation = useUpdateUserRole();
  const toggleActiveMutation = useToggleUserActive();
  const deleteUserMutation = useDeleteUser();
  const createUserMutation = useCreateUser();
  const updateManagerNoMutation = useUpdateUserManagerNo();
  const queryClient = useQueryClient();

  return {
    users,
    loading,
    error: error?.message || null,
    loadUsers: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
    changeUserRole: async (userId: string, newRole: UserRole) => {
      await updateRoleMutation.mutateAsync({ userId, newRole });
    },
    toggleActive: async (userId: string) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return;
      await toggleActiveMutation.mutateAsync({
        userId,
        isActive: !user.is_active,
      });
    },
    removeUser: async (userId: string) => {
      await deleteUserMutation.mutateAsync(userId);
    },
    createUser: async (userData: {
      email: string;
      display_name: string;
      role: UserRole;
    }) => {
      return await createUserMutation.mutateAsync(userData);
    },
    updateManagerNo: async (userId: string, value: string | null) => {
      await updateManagerNoMutation.mutateAsync({ userId, managerNo: value });
    },
  };
}
