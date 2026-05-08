'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShieldIcon, UserIcon } from 'lucide-react';

export type UserRow = {
  id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role: 'admin' | 'am';
  is_active: boolean;
  created_at?: string | null;
};

interface UsersTableProps {
  data: UserRow[];
  currentUserId?: string;
  onChangeRole: (userId: string, role: 'admin' | 'am') => void;
  onToggleActive: (userId: string, checked: boolean) => void;
}

// 상수 정의
const COLUMN_WIDTHS = {
  user: '300px',
  role: '200px',
  lastLogin: '150px',
} as const;

// 셀 컴포넌트 분리
interface UserCellProps {
  user: UserRow;
}

const UserCell = React.memo(
  ({ user }: UserCellProps) => {
    const [imageError, setImageError] = React.useState(false);
    const lastAvatarUrlRef = React.useRef(user.avatar_url);
    
    // avatar_url이 변경되면 에러 상태 리셋
    React.useEffect(() => {
      if (lastAvatarUrlRef.current !== user.avatar_url) {
        lastAvatarUrlRef.current = user.avatar_url;
        setImageError(false);
      }
    }, [user.avatar_url]);
    
    const handleImageError = React.useCallback(() => {
      setImageError(true);
    }, []);

            // avatar_url이 있고 에러가 없을 때만 이미지 표시
            const shouldShowImage = user.avatar_url && !imageError;

            return (
              <div className='flex items-center gap-2.5'>
                <Avatar className='h-7 w-7'>
                  {shouldShowImage && user.avatar_url ? (
                    <AvatarImage
                      src={user.avatar_url}
                      alt={user.display_name || user.email || 'User'}
                      onError={handleImageError}
                    />
                  ) : null}
          <AvatarFallback>
            {user.display_name?.charAt(0) || user.email?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className='font-medium leading-tight'>
            {user.display_name || '알 수 없음'}
          </div>
          <div className='text-xs text-muted-foreground leading-tight'>
            {user.email}
          </div>
        </div>
      </div>
    );
  },
  // 커스텀 비교 함수: user.id와 avatar_url 비교
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.user.avatar_url === nextProps.user.avatar_url
    );
  }
);
UserCell.displayName = 'UserCell';

interface RoleCellProps {
  user: UserRow;
  disabled: boolean;
  onChangeRole: (userId: string, role: 'admin' | 'am') => void;
}

const RoleCell = React.memo(
  ({ user, disabled, onChangeRole }: RoleCellProps) => {
    const [localRole, setLocalRole] = React.useState(user.role);
    const lastUserIdRef = React.useRef(user.id);

    // 사용자 ID가 변경되면 초기화
    if (lastUserIdRef.current !== user.id) {
      lastUserIdRef.current = user.id;
      setLocalRole(user.role);
    }

    // 초기 마운트 시에만 서버 상태로 동기화
    React.useEffect(() => {
      if (lastUserIdRef.current === user.id) {
        setLocalRole(user.role);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.id]);

    const handleValueChange = React.useCallback(
      async (value: string) => {
        const newRole = value as 'admin' | 'am';
        setLocalRole(newRole);
        
        // 비동기 작업 실행 (에러 시 이전 상태로 복원)
        try {
          await onChangeRole(user.id, newRole);
        } catch (error) {
          // 에러 발생 시 이전 상태로 복원
          setLocalRole(user.role);
        }
      },
      [user.id, user.role, onChangeRole]
    );

    return (
      <Select
        value={localRole}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className='w-[110px] h-8 text-xs px-2'>
          <div className='flex items-center gap-2'>
            {localRole === 'admin' ? (
              <ShieldIcon className='size-3' />
            ) : (
              <UserIcon className='size-3' />
            )}
            <SelectValue placeholder='역할 선택' />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='admin'>ADMIN</SelectItem>
          <SelectItem value='am'>AM</SelectItem>
        </SelectContent>
      </Select>
    );
  },
  // 커스텀 비교 함수: user.id와 disabled만 비교 (user.role 변경 무시)
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.onChangeRole === nextProps.onChangeRole
    );
  }
);
RoleCell.displayName = 'RoleCell';

interface StatusCellProps {
  user: UserRow;
  disabled: boolean;
  onToggleActive: (userId: string, checked: boolean) => void;
}

/**
 * Status 컬럼 셀 - Shadcn Switch 컴포넌트 사용
 * TestSwitchCell처럼 단순하게 동작: 사용자가 조작할 때는 서버 상태와 무관하게 로컬 상태만 사용
 */
const StatusCell = React.memo(
  ({ user, disabled, onToggleActive }: StatusCellProps) => {
    // TestSwitchCell처럼 단순한 로컬 상태만 사용
    const [localChecked, setLocalChecked] = React.useState(user.is_active);
    const lastUserIdRef = React.useRef(user.id);

    // 사용자 ID가 변경되면 초기화 (다른 행으로 이동한 경우)
    if (lastUserIdRef.current !== user.id) {
      lastUserIdRef.current = user.id;
      setLocalChecked(user.is_active);
    }

    // 초기 마운트 시에만 서버 상태로 동기화
    // user.is_active는 의존성에서 제외하여 변경되어도 재렌더링되지 않도록
    React.useEffect(() => {
      if (lastUserIdRef.current === user.id) {
        // 초기값 설정 (한 번만 실행)
        setLocalChecked(user.is_active);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.id]); // user.id만 의존성으로 사용

    const handleCheckedChange = React.useCallback(
      async (checked: boolean) => {
        // 즉시 로컬 상태 업데이트
        setLocalChecked(checked);

        // 비동기 작업 실행 (에러 시 이전 상태로 복원)
        try {
          await onToggleActive(user.id, checked);
        } catch (error) {
          // 에러 발생 시 이전 상태로 복원
          setLocalChecked(user.is_active);
        }
      },
      [user.id, user.is_active, onToggleActive]
    );

    return (
      <Switch
        checked={localChecked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        aria-label={`Toggle ${
          user.display_name || user.email || 'user'
        } active status`}
      />
    );
  },
  // 커스텀 비교 함수: user.id만 비교 (user.is_active 변경 무시)
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.onToggleActive === nextProps.onToggleActive
    );
  }
);
StatusCell.displayName = 'StatusCell';

interface LastLoginCellProps {
  createdAt: string | null | undefined;
}

const LastLoginCell = React.memo(
  ({ createdAt }: LastLoginCellProps) => (
    <span className='tabular-nums'>
      {createdAt ? new Date(createdAt).toLocaleDateString() : '없음'}
    </span>
  ),
  // 커스텀 비교 함수: 항상 동일하다고 간주 (재렌더링 최소화)
  () => true
);
LastLoginCell.displayName = 'LastLoginCell';

// 헬퍼 함수
const getColumnWidth = (columnId: string): string => {
  return COLUMN_WIDTHS[columnId as keyof typeof COLUMN_WIDTHS] || 'auto';
};

// 메모이제이션된 행 컴포넌트
// user 객체의 참조가 변경되어도 user.id가 같으면 재렌더링하지 않음
interface MemoizedTableRowProps {
  user: UserRow;
  disabled: boolean;
  currentUserId?: string;
  onChangeRole: (userId: string, role: 'admin' | 'am') => void;
  onToggleActive: (userId: string, checked: boolean) => void;
}

const MemoizedTableRow = React.memo(
  ({ user, disabled, onChangeRole, onToggleActive }: MemoizedTableRowProps) => {
    return (
      <TableRow className='h-10'>
        <TableCell
          style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }}
          className='text-left'
        >
          <UserCell user={user} />
        </TableCell>
        <TableCell
          style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}
          className='text-left'
        >
          <RoleCell
            user={user}
            disabled={disabled}
            onChangeRole={onChangeRole}
          />
        </TableCell>
        <TableCell className='text-left'>
          <StatusCell
            user={user}
            disabled={disabled}
            onToggleActive={onToggleActive}
          />
        </TableCell>
        <TableCell
          style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}
          className='text-left'
        >
          <LastLoginCell createdAt={user.created_at} />
        </TableCell>
      </TableRow>
    );
  },
  // 커스텀 비교 함수: user.id만 비교하여 데이터가 변경되어도 재렌더링하지 않음
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.currentUserId === nextProps.currentUserId &&
      prevProps.onChangeRole === nextProps.onChangeRole &&
      prevProps.onToggleActive === nextProps.onToggleActive
    );
  }
);
MemoizedTableRow.displayName = 'MemoizedTableRow';

export const UsersTable = React.memo(
  function UsersTable({
    data,
    currentUserId,
    onChangeRole,
    onToggleActive,
  }: UsersTableProps) {
    return (
      <div className='overflow-hidden rounded-xl border'>
        <Table className='table-auto w-full'>
          <TableHeader className='sticky top-0 z-20 bg-muted [&_th]:py-2 [&_th]:px-2 [&_th]:h-9'>
            <TableRow>
              <TableHead
                style={{ width: '300px', minWidth: '300px', maxWidth: '300px' }}
                className='text-left'
              >
                사용자
              </TableHead>
              <TableHead
                style={{ width: '200px', minWidth: '200px', maxWidth: '200px' }}
                className='text-left'
              >
                역할
              </TableHead>
              <TableHead className='text-left'>상태</TableHead>
              <TableHead
                style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}
                className='text-left'
              >
                생성일
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className='[&_td]:py-2 [&_td]:px-2'>
            {data.length > 0 ? (
              data.map((user) => (
                <MemoizedTableRow
                  key={user.id}
                  user={user}
                  disabled={currentUserId === user.id}
                  currentUserId={currentUserId}
                  onChangeRole={onChangeRole}
                  onToggleActive={onToggleActive}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className='h-24 text-center'>
                  결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  },
  // 커스텀 비교 함수: data 배열의 ID만 비교
  (prevProps, nextProps) => {
    // currentUserId, onChangeRole, onToggleActive는 참조가 동일하면 변경 없음
    if (
      prevProps.currentUserId !== nextProps.currentUserId ||
      prevProps.onChangeRole !== nextProps.onChangeRole ||
      prevProps.onToggleActive !== nextProps.onToggleActive
    ) {
      return false;
    }

    // data 배열의 길이가 다르면 변경됨
    if (prevProps.data.length !== nextProps.data.length) {
      return false;
    }

    // data 배열의 ID만 비교 (실제 데이터 내용 변경은 무시)
    const prevIds = prevProps.data.map((u) => u.id).join(',');
    const nextIds = nextProps.data.map((u) => u.id).join(',');

    return prevIds === nextIds;
  }
);
