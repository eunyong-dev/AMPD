'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  TargetIcon,
  RefreshCw,
  ExternalLink,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  EditIcon,
  TrashIcon,
} from 'lucide-react';
import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DateRangePicker,
  type DateRangePreset,
} from '@/components/common/date-range-picker';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canManageResource } from '@/lib/utils/permissions';
import { useUserContext } from '@/lib/user-context';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  type Campaign,
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  MMP_OPTIONS,
  REGION_OPTIONS,
} from '@/hooks/use-campaign-management';
import { parseSheetDate } from '@/lib/utils/sheet-formatters';
import { useUserManagement } from '@/hooks/use-user-management';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { EditCampaignForm } from '@/components/campaigns/edit-campaign-form';
import { DailyReportTable } from '@/components/campaigns/campaign-detail/daily-report-table';
import { MonthlySummaryTable } from '@/components/campaigns/campaign-detail/monthly-summary-table';
import { PeriodComparison } from '@/components/campaigns/campaign-detail/period-comparison';
import { isRoasColumn, roasBgStyle, parseRoasPercent } from '@/lib/utils/roas';
import { convertStoreUrlByRegion } from '@/lib/store-url-utils';
import {
  aggregateCampaignMetrics,
  filterRowsByDateRange,
  findDateHeader as findCampaignDateHeader,
} from '@/lib/utils/campaign-metrics';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { getAllGames } from '@/hooks/use-game-management';
import { accountUrl } from '@/lib/utils/account-url';
import { formatDateYYYYMMDD } from '@/lib/utils/date';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SheetData {
  [key: string]: any;
}

// Google Sheets URL에서 sheetId와 gid 추출
function extractSheetParams(
  url: string
): { sheetId: string; gid: string } | null {
  try {
    // Google Sheets URL 형식: https://docs.google.com/spreadsheets/d/{sheetId}/edit?gid={gid}#gid={gid}
    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[#&]gid=(\d+)/);

    if (sheetIdMatch && gidMatch) {
      return {
        sheetId: sheetIdMatch[1],
        gid: gidMatch[1],
      };
    }

    return null;
  } catch (error) {
    console.error('URL 파싱 오류:', error);
    return null;
  }
}


// ROAS 코호트 정의 — shadcn Area Chart - Gradient 톤 차용
// 단일 blue hue, 옅은 sky → 짙은 indigo로 코호트 진행을 표현
// Overall은 가장 어두운 톤으로 강조
const ROAS_COHORTS = [
  { key: 'ROAS', label: 'Overall', color: 'hsl(224 76% 28%)' },
  { key: 'D0 ROAS', label: 'D0', color: 'hsl(214 95% 87%)' },
  { key: 'D1 ROAS', label: 'D1', color: 'hsl(213 94% 78%)' },
  { key: 'D7 ROAS', label: 'D7', color: 'hsl(217 91% 65%)' },
  { key: 'D14 ROAS', label: 'D14', color: 'hsl(221 83% 53%)' },
  { key: 'D30 ROAS', label: 'D30', color: 'hsl(224 76% 40%)' },
] as const;

const ROAS_CHART_CONFIG: ChartConfig = ROAS_COHORTS.reduce(
  (acc, c) => ({ ...acc, [c.key]: { label: c.label, color: c.color } }),
  {}
);

// Monthly 차트도 동일 blue family로 통일 (light=Cost, dark=Revenue)
const MONTHLY_CHART_CONFIG: ChartConfig = {
  Cost: { label: 'Cost', color: 'hsl(213 94% 78%)' },
  Revenue: { label: 'Revenue', color: 'hsl(221 83% 53%)' },
};

// Volume 차트의 메트릭들
const VOLUME_METRICS = [
  { key: 'Install', label: 'Install', color: 'hsl(217 91% 65%)' },
  { key: 'Cost', label: 'Cost', color: 'hsl(213 94% 78%)' },
  { key: 'Revenue', label: 'Revenue', color: 'hsl(221 83% 53%)' },
] as const;

const VOLUME_CHART_CONFIG: ChartConfig = VOLUME_METRICS.reduce(
  (acc, m) => ({ ...acc, [m.key]: { label: m.label, color: m.color } }),
  {}
);

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<SheetData[] | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [showEditCampaignForm, setShowEditCampaignForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [allGames, setAllGames] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<
    | {
        from: Date | undefined;
        to: Date | undefined;
      }
    | undefined
  >(undefined);
  // 한 번에 하나의 코호트만 표시 (single-select)
  const [visibleCohort, setVisibleCohort] = useState<string>('ROAS');
  // 차트 단위 — daily / weekly / monthly
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>(
    'daily'
  );
  // 활성 탭 (controlled) — Charts 탭일 때만 granularity 드롭다운 표시
  const [activeTab, setActiveTab] = useState<string>('daily');
  // Volume 차트의 메트릭 (단일 선택)
  const [visibleMetric, setVisibleMetric] = useState<string>('Install');
  const [lastDate, setLastDate] = useState<Date | null>(null); // 마지막 날짜 저장
  // 기간 비교 모드
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);
  const [compareDateRange, setCompareDateRange] = useState<
    | {
        from: Date | undefined;
        to: Date | undefined;
      }
    | undefined
  >(undefined);

  const { users: activeUsers } = useUserManagement();
  const { profile: userProfile } = useUserContext();

  // 권한 확인
  const assignedUserId =
    campaign?.assigned_user_id !== undefined ? campaign.assigned_user_id : '';
  const isManageAllowed = canManageResource(userProfile, assignedUserId);

  // 게임 목록 로드
  useEffect(() => {
    const loadGames = async () => {
      try {
        const games = await getAllGames();
        setAllGames(games);
      } catch (err) {
        console.error('게임 로드 오류:', err);
      }
    };
    loadGames();
  }, []);

  // 캠페인 수정
  const handleUpdateCampaign = useCallback(
    async (
      campaignId: string,
      campaignData: Partial<Campaign>
    ): Promise<void> => {
      try {
        const updatedCampaign = await updateCampaign(campaignId, campaignData);
        setCampaign(updatedCampaign);
        toast.success('캠페인이 업데이트되었습니다.');
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : '캠페인을 업데이트하는 중 오류가 발생했습니다.';
        toast.error(`캠페인 업데이트 실패: ${errorMessage}`);
        throw err;
      }
    },
    []
  );

  // 편집 핸들러
  const handleEditCampaign = useCallback(() => {
    if (!campaign) return;
    setShowEditCampaignForm(true);
  }, [campaign]);

  // 삭제 클릭 핸들러
  const handleDeleteClick = useCallback(() => {
    if (!campaign) return;

    if (!isManageAllowed) {
      toast.error(
        '본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다.'
      );
      return;
    }
    setShowDeleteDialog(true);
  }, [campaign, isManageAllowed]);

  // 삭제 확인 핸들러
  const handleDeleteCampaign = useCallback(async () => {
    if (!campaign) return;

    try {
      await deleteCampaign(campaign.id);
      toast.success('캠페인이 삭제되었습니다');
      router.push('/campaigns');
    } catch (err) {
      toast.error(
        `캠페인 삭제 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  }, [campaign, router]);

  // 게임 이미지: DB의 game_logo_url만 사용. NULL이면 placeholder.
  // 레거시 게임은 Settings → "Refresh missing logos"로 일괄 채움.
  const imageUrl = campaign?.game_logo_url || null;
  const imageLoading = false;

  // 이미지 프리로드 (성능 개선)
  useEffect(() => {
    if (imageUrl) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = imageUrl;
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [imageUrl]);

  // 스토어 favicon URL 생성
  const storeFaviconUrl = useMemo(() => {
    const url = campaign?.game_store_url;
    if (!url) return null;

    if (/apps\.apple\.com|itunes\.apple\.com/i.test(url)) {
      return 'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=32';
    }
    if (/play\.google\.com/i.test(url)) {
      return 'https://www.google.com/s2/favicons?domain=play.google.com&sz=32';
    }
    return null;
  }, [campaign?.game_store_url]);

  // 담당자 정보 찾기
  const assignedUser = useMemo(() => {
    if (!campaign?.assigned_user_id || !activeUsers.length) return null;
    return activeUsers.find((u) => u.id === campaign.assigned_user_id);
  }, [campaign?.assigned_user_id, activeUsers]);

  // 캠페인 정보 로드
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        setLoading(true);
        const campaignData = await getCampaignById(campaignId);
        if (campaignData) {
          setCampaign(campaignData);
          // Report URL이 있으면 자동으로 데이터 가져오기 (초기 로드: 마지막 날짜 기준 30일)
          if (campaignData.daily_report_url) {
            fetchSheetData(campaignData.daily_report_url);
          }
        } else {
          toast.error('캠페인을 찾을 수 없습니다.');
          router.push('/campaigns');
        }
      } catch (err) {
        console.error('캠페인 로드 오류:', err);
        toast.error('캠페인을 불러올 수 없습니다.');
        router.push('/campaigns');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId, router]);

  // 날짜를 YYYY-MM-DD 형식으로 변환
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 날짜 컬럼 이름 찾기
  const findDateHeader = (row: SheetData | undefined): string | null => {
    if (!row) return null;
    return (
      Object.keys(row).find(
        (h) => h === '날짜' || h === 'date' || h.toLowerCase() === 'date'
      ) ?? null
    );
  };

  // Google Sheets 데이터 가져오기 (전체를 한 번에 로드, 필터는 클라이언트에서)
  // forceRefresh=true면 서버 캐시 무시하고 최신 데이터 fetch
  const fetchSheetData = async (
    reportUrl: string,
    forceRefresh = false
  ) => {
    setDataLoading(true);
    setDataError(null);

    try {
      const params = extractSheetParams(reportUrl);
      if (!params) {
        throw new Error('Invalid Google Sheets URL.');
      }

      const urlParams = new URLSearchParams({
        gid: params.gid,
        sheetId: params.sheetId,
      });
      if (forceRefresh) urlParams.set('noCache', '1');

      const response = await fetch(
        `/api/google-sheets?${urlParams.toString()}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `API 호출 실패: ${response.status}`);
      }

      let fetchedData: SheetData[] = [];
      if (Array.isArray(result.data)) {
        fetchedData = result.data;
      } else if (result.data && typeof result.data === 'object') {
        fetchedData = [result.data];
      }

      // 오래된 날짜부터 정렬
      const dateHeader = findDateHeader(fetchedData[0]);
      if (dateHeader) {
        fetchedData = fetchedData.sort((a, b) => {
          const dateA = parseSheetDate(a[dateHeader]);
          const dateB = parseSheetDate(b[dateHeader]);
          if (!dateA || !dateB) return 0;
          return dateA.getTime() - dateB.getTime();
        });

        // 최신 날짜 저장 (날짜 필터 기본값 계산용)
        const maxDate = fetchedData
          .map((row) => parseSheetDate(row[dateHeader]))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        if (maxDate) setLastDate(maxDate);
      }

      setAllData(fetchedData);
      toast.success('데이터를 불러왔습니다.');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setDataError(errorMessage);
      toast.error(`데이터 불러오기 실패: ${errorMessage}`);
      console.error('Google Sheets 데이터 가져오기 오류:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // DateRangePicker presets:
  //  - last-N-days / all: 시트 데이터 기준 (lastDate, allData의 min/max)
  //  - last-week / last-month: 실제 달력 기준 (오늘)
  const datePickerPresets = useMemo<DateRangePreset[]>(() => {
    const nDays = (n: number) => {
      if (!lastDate) return null;
      const to = new Date(lastDate);
      const from = new Date(lastDate);
      from.setDate(from.getDate() - (n - 1));
      return { from, to };
    };

    return [
      {
        id: 'last-7',
        label: 'Last 7 days',
        getRange: () => nDays(7),
      },
      {
        id: 'last-14',
        label: 'Last 14 days',
        getRange: () => nDays(14),
      },
      {
        id: 'last-30',
        label: 'Last 30 days',
        getRange: () => nDays(30),
      },
      {
        id: 'last-90',
        label: 'Last 90 days',
        getRange: () => nDays(90),
      },
      { id: '---', label: '', getRange: () => null },
      {
        id: 'last-week',
        label: 'Last week',
        getRange: () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const day = today.getDay();
          const lastMonday = new Date(today);
          lastMonday.setDate(today.getDate() - ((day + 6) % 7) - 7);
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          return { from: lastMonday, to: lastSunday };
        },
      },
      {
        id: 'last-month',
        label: 'Last month',
        getRange: () => {
          const today = new Date();
          const thisMonthFirst = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );
          const lastMonthFirst = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            1
          );
          const lastMonthLast = new Date(thisMonthFirst);
          lastMonthLast.setDate(0);
          return { from: lastMonthFirst, to: lastMonthLast };
        },
      },
      { id: '---', label: '', getRange: () => null },
      {
        id: 'all',
        label: 'All time',
        getRange: () => {
          if (!allData || allData.length === 0) return null;
          const dateHeader = findDateHeader(allData[0]);
          if (!dateHeader) return null;
          const dates = allData
            .map((r) => parseSheetDate(r[dateHeader]))
            .filter((d): d is Date => d !== null);
          if (dates.length === 0) return null;
          const min = new Date(Math.min(...dates.map((d) => d.getTime())));
          const max = new Date(Math.max(...dates.map((d) => d.getTime())));
          return { from: min, to: max };
        },
      },
    ];
  }, [lastDate, allData]);

  // 전체 데이터 + 날짜 범위 조합으로 화면에 표시할 데이터를 도출
  // dateRange 미설정 시: 최신 날짜 기준 30일
  // dateRange 설정 시: 해당 범위 (부분 설정도 허용)
  // 날짜가 비어있는 행(시트에 미리 만들어 둔 빈 행)은 항상 제외
  const data = useMemo<SheetData[] | null>(() => {
    if (!allData) return null;

    const dateHeader = findDateHeader(allData[0]);
    if (!dateHeader) return allData;

    // 날짜가 파싱되지 않는 행은 표시에서 제외
    const rowsWithDate = allData.filter(
      (row) => parseSheetDate(row[dateHeader]) !== null
    );

    let from: Date | undefined;
    let to: Date | undefined;

    if (dateRange) {
      from = dateRange.from;
      to = dateRange.to;
    } else if (lastDate) {
      to = lastDate;
      from = new Date(lastDate);
      from.setDate(from.getDate() - 30);
    }

    if (!from && !to) return rowsWithDate;

    const fromStr = from ? formatDateForAPI(from) : null;
    const toStr = to ? formatDateForAPI(to) : null;

    return rowsWithDate.filter((row) => {
      const d = parseSheetDate(row[dateHeader])!;
      const s = formatDateForAPI(d);
      if (fromStr && s < fromStr) return false;
      if (toStr && s > toStr) return false;
      return true;
    });
  }, [allData, dateRange, lastDate]);

  // 비교 기간 메트릭 (compareEnabled + compareDateRange 모두 있을 때만)
  const comparisonMetrics = useMemo(() => {
    if (!compareEnabled || !allData || allData.length === 0) return null;
    const dateHeader = findCampaignDateHeader(allData[0]);
    if (!dateHeader) return null;

    const currentRows = data ?? [];
    const compareRows = filterRowsByDateRange(
      allData,
      compareDateRange?.from,
      compareDateRange?.to,
      dateHeader
    );

    return {
      current: aggregateCampaignMetrics(currentRows),
      comparison: aggregateCampaignMetrics(compareRows),
    };
  }, [compareEnabled, allData, data, compareDateRange]);

  // 테이블 헤더 생성
  const headers = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  // 월간 집계. Date Range 필터와 무관하게 전체 데이터(allData) 기준.
  // ROAS / CPI / CVR 같은 비율 컬럼은 단순 합산이 아니라 재계산.
  const monthlySummary = useMemo(() => {
    if (!allData || allData.length === 0) return null;
    const dateHeader = findDateHeader(allData[0]);
    if (!dateHeader) return null;

    const parseNumeric = (val: unknown): number | null => {
      if (val === null || val === undefined) return null;
      const str = String(val).trim();
      if (!str || str === '-') return null;
      const hasPercent = str.endsWith('%');
      const cleaned = str.replace(/[$,\s]/g, '').replace(/%$/, '');
      const n = parseFloat(cleaned);
      if (isNaN(n)) return null;
      return hasPercent ? n / 100 : n;
    };

    // 비율 컬럼 재계산 규칙 (컬럼명 정확 매칭)
    const recalc: Record<
      string,
      (s: Record<string, number>) => number | null
    > = {
      CPI: (s) => (s['Install'] > 0 ? s['Cost'] / s['Install'] : null),
      ROAS: (s) => (s['Cost'] > 0 ? s['Revenue'] / s['Cost'] : null),
      CVR: (s) => (s['Clicks'] > 0 ? s['Install'] / s['Clicks'] : null),
      'D0 ROAS': (s) => (s['Cost'] > 0 ? s['D0 Revenue'] / s['Cost'] : null),
      'D1 ROAS': (s) => (s['Cost'] > 0 ? s['D1 Revenue'] / s['Cost'] : null),
      'D7 ROAS': (s) => (s['Cost'] > 0 ? s['D7 Revenue'] / s['Cost'] : null),
      'D14 ROAS': (s) => (s['Cost'] > 0 ? s['D14 Revenue'] / s['Cost'] : null),
      'D30 ROAS': (s) => (s['Cost'] > 0 ? s['D30 Revenue'] / s['Cost'] : null),
    };

    const dataColumns = Object.keys(allData[0]).filter(
      (h) => h !== dateHeader
    );

    // 컬럼별 표시 형식 감지 (첫 유효 값 기준)
    const columnFormats: Record<string, 'dollar' | 'percent' | 'number'> = {};
    for (const col of dataColumns) {
      columnFormats[col] = 'number';
      for (const row of allData) {
        const val = String(row[col] ?? '').trim();
        if (!val || val === '-') continue;
        if (val.startsWith('$')) columnFormats[col] = 'dollar';
        else if (val.endsWith('%')) columnFormats[col] = 'percent';
        else columnFormats[col] = 'number';
        break;
      }
    }

    // 월별 그룹화
    const groups: Record<string, SheetData[]> = {};
    for (const row of allData) {
      const d = parseSheetDate(row[dateHeader]);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    // 월별 합계 + 재계산 + 포맷
    const format = (
      num: number | null,
      fmt: 'dollar' | 'percent' | 'number'
    ) => {
      if (num === null || !isFinite(num)) return '-';
      if (fmt === 'dollar') return `$ ${num.toFixed(2)}`;
      if (fmt === 'percent') return `${(num * 100).toFixed(2)}%`;
      return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2);
    };

    return Object.keys(groups)
      .sort()
      .map((month) => {
        const rows = groups[month];
        const sums: Record<string, number> = {};
        for (const col of dataColumns) {
          sums[col] = 0;
          for (const row of rows) {
            const n = parseNumeric(row[col]);
            if (n !== null) sums[col] += n;
          }
        }

        const out: Record<string, string> = { Month: month };
        for (const col of dataColumns) {
          const value = recalc[col] ? recalc[col](sums) : sums[col];
          out[col] = format(value, columnFormats[col]);
        }
        return out;
      });
  }, [allData]);

  // 차트: 일별 데이터 (Date Range 필터 반영된 data 기준)
  // - ROAS 계열은 %단위 값으로 변환 (130.20 형태)
  // - Install/Cost/Revenue 등은 숫자 원본
  const dailyChartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const dateHeader = findDateHeader(data[0]);
    if (!dateHeader) return [];

    return data
      .map((row) => {
        const d = parseSheetDate(row[dateHeader]);
        if (!d) return null;
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        const entry: Record<string, string | number> = { date: label };
        for (const [key, raw] of Object.entries(row)) {
          if (key === dateHeader) continue;
          // 비고/note 컬럼은 텍스트 그대로 보존 (차트 marker / 툴팁 표시용)
          if (
            key === '비고' ||
            key.toLowerCase() === 'note' ||
            key.toLowerCase() === 'memo' ||
            key.toLowerCase() === 'remark'
          ) {
            const text = raw == null ? '' : String(raw).trim();
            if (text) entry['note'] = text;
            continue;
          }
          const n = parseRoasPercent(raw);
          if (n === null) continue;
          entry[key] = isRoasColumn(key) ? +(n * 100).toFixed(2) : n;
        }
        return entry;
      })
      .filter((v): v is Record<string, string | number> => v !== null);
  }, [data]);

  // 주 시작일(월요일) 구하기
  const getMondayOfWeek = (d: Date): Date => {
    const day = d.getDay(); // 0=일, 1=월, ... 6=토
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  // 차트: 주별 데이터 (절대값 합산 + ROAS 재계산)
  const weeklyChartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const dateHeader = findDateHeader(data[0]);
    if (!dateHeader) return [];

    // 합산 대상 절대값 컬럼
    const numCols = [
      'Install',
      'Cost',
      'Revenue',
      'Clicks',
      'D0 Revenue',
      'D1 Revenue',
      'D7 Revenue',
      'D14 Revenue',
      'D30 Revenue',
    ];

    // 주별 그룹화 (월요일 키)
    const groups = new Map<string, SheetData[]>();
    for (const row of data) {
      const d = parseSheetDate(row[dateHeader]);
      if (!d) continue;
      const monday = getMondayOfWeek(d);
      const key = formatDateForAPI(monday);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    return Array.from(groups.keys())
      .sort()
      .map((key) => {
        const rows = groups.get(key)!;
        const monday = new Date(`${key}T00:00:00`);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        // 같은 달이면 "3/16-22", 다른 달이면 "3/30-4/5"
        const label =
          monday.getMonth() === sunday.getMonth()
            ? `${monday.getMonth() + 1}/${monday.getDate()}-${sunday.getDate()}`
            : `${monday.getMonth() + 1}/${monday.getDate()}-${
                sunday.getMonth() + 1
              }/${sunday.getDate()}`;

        // 절대값 합산
        const sums: Record<string, number> = {};
        for (const col of numCols) {
          sums[col] = 0;
          for (const row of rows) {
            const n = parseRoasPercent(row[col]);
            if (n !== null) sums[col] += n;
          }
        }

        const out: Record<string, string | number> = {
          date: label,
          ...sums,
        };

        // 그 주의 비고들을 모아 결합
        const notes = rows
          .map((r) => String(r['비고'] ?? '').trim())
          .filter((n) => n);
        if (notes.length > 0) out['note'] = notes.join(' / ');

        // ROAS 재계산 (% 단위)
        if (sums['Cost'] > 0) {
          out['ROAS'] = +((sums['Revenue'] / sums['Cost']) * 100).toFixed(2);
          out['D0 ROAS'] = +(
            (sums['D0 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D1 ROAS'] = +(
            (sums['D1 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D7 ROAS'] = +(
            (sums['D7 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D14 ROAS'] = +(
            (sums['D14 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D30 ROAS'] = +(
            (sums['D30 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
        }

        return out;
      });
  }, [data]);

  // 차트: 월별 데이터 (data 기준, weekly와 동일한 패턴)
  const monthlyChartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const dateHeader = findDateHeader(data[0]);
    if (!dateHeader) return [];

    const numCols = [
      'Install',
      'Cost',
      'Revenue',
      'Clicks',
      'D0 Revenue',
      'D1 Revenue',
      'D7 Revenue',
      'D14 Revenue',
      'D30 Revenue',
    ];

    // 월별 그룹화 (YYYY-MM 키)
    const groups = new Map<string, SheetData[]>();
    for (const row of data) {
      const d = parseSheetDate(row[dateHeader]);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    return Array.from(groups.keys())
      .sort()
      .map((key) => {
        const rows = groups.get(key)!;

        const sums: Record<string, number> = {};
        for (const col of numCols) {
          sums[col] = 0;
          for (const row of rows) {
            const n = parseRoasPercent(row[col]);
            if (n !== null) sums[col] += n;
          }
        }

        const out: Record<string, string | number> = {
          date: key, // chartData 키 통일
          ...sums,
        };

        // 그 달의 비고들을 모아 결합
        const notes = rows
          .map((r) => String(r['비고'] ?? '').trim())
          .filter((n) => n);
        if (notes.length > 0) out['note'] = notes.join(' / ');

        if (sums['Cost'] > 0) {
          out['ROAS'] = +((sums['Revenue'] / sums['Cost']) * 100).toFixed(2);
          out['D0 ROAS'] = +(
            (sums['D0 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D1 ROAS'] = +(
            (sums['D1 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D7 ROAS'] = +(
            (sums['D7 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D14 ROAS'] = +(
            (sums['D14 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
          out['D30 ROAS'] = +(
            (sums['D30 Revenue'] / sums['Cost']) *
            100
          ).toFixed(2);
        }

        return out;
      });
  }, [data]);

  // ROAS / Volume / Cost-Revenue 차트가 공유하는 데이터 (granularity 적용)
  const chartData =
    granularity === 'monthly'
      ? monthlyChartData
      : granularity === 'weekly'
      ? weeklyChartData
      : dailyChartData;

  // 비고 마커 — 비고 있는 포인트만 노란 점, 나머지는 안 보임
  const renderNoteDot = (props: any) => {
    const { cx, cy, payload, key, index } = props;
    const hasNote = Boolean(payload?.note);
    return (
      <circle
        key={key ?? `dot-${index}`}
        cx={cx}
        cy={cy}
        r={hasNote ? 5 : 0}
        fill={hasNote ? '#f59e0b' : 'transparent'}
        stroke={hasNote ? '#fff' : 'transparent'}
        strokeWidth={hasNote ? 2 : 0}
      />
    );
  };

  // 툴팁 — 기본 ChartTooltipContent + 비고 있으면 하단에 메모 박스 추가
  const renderTooltipWithNote = (
    props: any,
    formatter: (value: any, name: any) => [string, string]
  ) => {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    const note = payload[0]?.payload?.note as string | undefined;
    return (
      <div className='overflow-hidden rounded-lg border bg-background shadow-xl'>
        <ChartTooltipContent
          active={active}
          payload={payload}
          label={label}
          indicator='dot'
          formatter={formatter}
          className='border-0 shadow-none'
        />
        {note ? (
          <div className='border-t bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-200'>
            📝 {note}
          </div>
        ) : null}
      </div>
    );
  };

  // 상태 표시용 함수 (다른 페이지와 동일한 스타일)
  const getStatusDisplay = (status: string | null) => {
    const statusOption = CAMPAIGN_STATUS_OPTIONS.find(
      (option) => option.value === status
    );
    if (!statusOption) {
      return { label: 'Unknown', variant: 'outline' as const, color: '' };
    }

    const colorMap: Record<string, string> = {
      planning: 'text-yellow-600 dark:text-yellow-500',
      ongoing: 'text-green-600 dark:text-green-500',
      holding: 'text-red-600 dark:text-red-500',
      end: 'text-gray-500 dark:text-gray-400',
    };

    return {
      label: statusOption.label,
      variant: 'outline' as const,
      color: colorMap[status || ''] || '',
    };
  };

  // 지역 표시용 함수
  const getRegionDisplay = (region: string | null): string => {
    if (!region) return 'Unknown';

    const regionEmojiMap: Record<string, string> = {
      KR: '🇰🇷',
      JP: '🇯🇵',
      TW: '🇹🇼',
      US: '🇺🇸',
      CN: '🇨🇳',
    };

    const emoji = regionEmojiMap[region] || '';
    return emoji ? `${emoji} ${region}` : region;
  };

  // 타입 표시용 함수
  const getTypeDisplay = (type: string | null): string => {
    const typeOption = CAMPAIGN_TYPE_OPTIONS.find(
      (option) => option.value === type
    );
    return typeOption?.label || type || 'Unknown';
  };

  // MMP 표시용 함수
  const getMMPDisplay = (mmp: string | null): string => {
    const mmpOption = MMP_OPTIONS.find((option) => option.value === mmp);
    return mmpOption?.label || mmp || 'Unknown';
  };

  // 지역별 store URL — 링크용
  const regionalUrl = useMemo(() => {
    if (campaign?.game_store_url && campaign?.region) {
      return convertStoreUrlByRegion(campaign.game_store_url, campaign.region);
    }
    return null;
  }, [campaign?.game_store_url, campaign?.region]);

  // 지역별 게임 이름: DB값만 사용. 레거시는 Settings에서 일괄 backfill.
  const regionalGameName = campaign?.regional_game_name || null;
  const gameNameLoading = false;

  if (loading) {
    return (
      <AccessControl>
        <div className='space-y-4'>
          {/* Header Skeleton */}
          <div className='flex items-center justify-between'>
            <div className='space-y-2'>
              <Skeleton className='h-8 w-64' />
              <Skeleton className='h-4 w-96' />
            </div>
          </div>

          {/* Campaign Info Card Skeleton */}
          <Card>
            <CardContent className='p-6'>
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className='space-y-2'>
                    <Skeleton className='h-4 w-20' />
                    <Skeleton className='h-6 w-32' />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Table Skeleton */}
          <Card>
            <CardContent className='p-6'>
              <Skeleton className='h-96 w-full' />
            </CardContent>
          </Card>
        </div>
      </AccessControl>
    );
  }

  if (!campaign) {
    return (
      <AccessControl>
        <div className='space-y-4'>
          <Card>
            <CardContent className='pt-6'>
              <p className='text-center text-muted-foreground'>
                캠페인을 찾을 수 없습니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </AccessControl>
    );
  }

  return (
    <AccessControl>
      <div className='space-y-4 w-full overflow-x-hidden'>
        {/* Campaign Information */}
        <div className='space-y-4'>
          {/* Information Table */}
          <TableWrapper>
            <div className='overflow-x-auto'>
              <Table style={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHeader className={TABLE_STYLES.header}>
                  <TableRow>
                    <TableHead style={{ width: '200px' }}>
                      캠페인명
                    </TableHead>
                    <TableHead style={{ width: '150px' }}>광고주</TableHead>
                    <TableHead style={{ width: '250px' }}>게임명</TableHead>
                    <TableHead style={{ width: '160px' }}>
                      담당자
                    </TableHead>
                    <TableHead
                      style={{ width: '120px' }}
                      className='text-center'
                    >
                      지역
                    </TableHead>
                    <TableHead
                      style={{ width: '80px' }}
                      className='text-center'
                    >
                      MMP
                    </TableHead>
                    <TableHead style={{ width: '120px' }}>타입</TableHead>
                    <TableHead style={{ width: '200px' }}>기간</TableHead>
                    <TableHead
                      style={{ width: '100px' }}
                      className='text-center'
                    >
                      Jira URL
                    </TableHead>
                    <TableHead
                      style={{ width: '100px' }}
                      className='text-center'
                    >
                      Report URL
                    </TableHead>
                    <TableHead style={{ width: '60px' }}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={TABLE_STYLES.body}>
                  <TableRow>
                    {/* Campaign Name */}
                    <TableCell>
                      <div className='text-sm font-medium truncate'>
                        {campaign.name || '-'}
                      </div>
                    </TableCell>

                    {/* Account */}
                    <TableCell>
                      {campaign.account_id && campaign.account_company ? (
                        <Link
                          href={accountUrl(campaign.account_company)}
                          className='text-sm font-medium text-primary hover:underline truncate block'
                        >
                          {campaign.account_company}
                        </Link>
                      ) : (
                        <span className='text-sm text-muted-foreground'>
                          알 수 없음
                        </span>
                      )}
                    </TableCell>

                    {/* Game Name */}
                    <TableCell>
                      {regionalUrl ? (
                        <GameThumbnailTooltip
                          imageUrl={imageUrl}
                          gameName={
                            gameNameLoading
                              ? null
                              : regionalGameName || campaign.game_name || null
                          }
                          packageIdentifier={
                            campaign.game_package_identifier || null
                          }
                          storeUrl={regionalUrl}
                          storeFaviconUrl={storeFaviconUrl || null}
                          enableCopy={true}
                        >
                          <a
                            href={regionalUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='flex items-center gap-2 flex-1 min-w-0'
                          >
                            {imageLoading ? (
                              <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center animate-pulse flex-shrink-0'>
                                <span className='text-[8px] text-muted-foreground'>
                                  ...
                                </span>
                              </div>
                            ) : imageUrl ? (
                              <div className='w-6 h-6 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
                                <Image
                                  src={imageUrl}
                                  alt={campaign.game_name || 'Game'}
                                  width={24}
                                  height={24}
                                  className='max-w-full max-h-full w-auto h-auto object-contain'
                                  unoptimized
                                />
                              </div>
                            ) : (
                              <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
                                <span className='text-[8px] text-muted-foreground'>
                                  -
                                </span>
                              </div>
                            )}
                            <span className='text-sm truncate w-[180px] max-w-[180px] hover:text-primary'>
                              {gameNameLoading
                                ? '...'
                                : regionalGameName || campaign.game_name || '-'}
                            </span>
                          </a>
                        </GameThumbnailTooltip>
                      ) : (
                        <div className='flex items-center gap-2 flex-1 min-w-0'>
                          {imageLoading ? (
                            <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center animate-pulse flex-shrink-0'>
                              <span className='text-[8px] text-muted-foreground'>
                                ...
                              </span>
                            </div>
                          ) : imageUrl ? (
                            <div className='w-6 h-6 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
                              <Image
                                src={imageUrl}
                                alt={campaign.game_name || 'Game'}
                                width={24}
                                height={24}
                                className='max-w-full max-h-full w-auto h-auto object-contain'
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
                              <span className='text-[8px] text-muted-foreground'>
                                -
                              </span>
                            </div>
                          )}
                          <span className='text-sm truncate w-[180px] max-w-[180px]'>
                            {campaign.game_name || '-'}
                          </span>
                        </div>
                      )}
                    </TableCell>

                    {/* Assigned User */}
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {campaign.assigned_user_name ? (
                          <>
                            <Avatar className='h-5 w-5'>
                              {campaign.assigned_user_avatar_url ? (
                                <AvatarImage
                                  src={campaign.assigned_user_avatar_url}
                                  alt={campaign.assigned_user_name}
                                />
                              ) : null}
                              <AvatarFallback className='text-xs'>
                                {campaign.assigned_user_name
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className='text-xs font-medium truncate'>
                              {campaign.assigned_user_name}
                            </div>
                          </>
                        ) : (
                          <div className='text-xs text-muted-foreground'>
                            미지정
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Region */}
                    <TableCell className='text-center'>
                      <div className='text-sm text-muted-foreground'>
                        {getRegionDisplay(campaign.region)}
                      </div>
                    </TableCell>

                    {/* MMP */}
                    <TableCell className='text-center'>
                      {campaign.mmp === 'Adjust' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className='flex items-center justify-center w-5 h-5 flex-shrink-0 mx-auto'>
                                <Image
                                  src='/Adjust Logo.svg'
                                  alt='Adjust'
                                  width={20}
                                  height={20}
                                  className='object-contain'
                                  unoptimized
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Adjust</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : campaign.mmp === 'AppsFlyer' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className='flex items-center justify-center w-5 h-5 flex-shrink-0 mx-auto'>
                                <Image
                                  src='/AppsFlyer Logo.svg'
                                  alt='AppsFlyer'
                                  width={20}
                                  height={20}
                                  className='object-contain w-auto h-auto'
                                  unoptimized
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>AppsFlyer</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <div className='text-sm text-muted-foreground'>
                        {getTypeDisplay(campaign.campaign_type)}
                      </div>
                    </TableCell>

                    {/* Date Range */}
                    <TableCell>
                      <div className='text-sm text-muted-foreground'>
                        {formatDateYYYYMMDD(campaign.start_date)} ~{' '}
                        {formatDateYYYYMMDD(campaign.end_date)}
                      </div>
                    </TableCell>

                    {/* Jira URL */}
                    <TableCell className='text-center'>
                      {campaign.jira_url ? (
                        <a
                          href={campaign.jira_url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center justify-center text-primary hover:underline'
                        >
                          <ExternalLinkIcon className='h-4 w-4' />
                        </a>
                      ) : (
                        <span className='text-sm text-muted-foreground'>-</span>
                      )}
                    </TableCell>

                    {/* Report URL */}
                    <TableCell className='text-center'>
                      {campaign.daily_report_url ? (
                        <a
                          href={campaign.daily_report_url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center justify-center text-primary hover:underline'
                        >
                          <ExternalLinkIcon className='h-4 w-4' />
                        </a>
                      ) : (
                        <span className='text-sm text-muted-foreground'>-</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant='ghost'
                            className='flex size-8 hover:bg-muted/50'
                            size='icon'
                          >
                            <MoreHorizontalIcon className='h-4 w-4' />
                            <span className='sr-only'>메뉴 열기</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align='end'
                          className='w-auto min-w-[120px]'
                        >
                          <DropdownMenuItem
                            onClick={handleEditCampaign}
                            className='flex items-center gap-0'
                            disabled={!isManageAllowed}
                          >
                            <EditIcon className='mr-1 h-4 w-4' />
                            캠페인 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleDeleteClick}
                            className='text-red-600 focus:text-red-600 flex items-center gap-0'
                            disabled={!isManageAllowed}
                          >
                            <TrashIcon className='mr-1 h-4 w-4' />
                            캠페인 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TableWrapper>
        </div>

        {/* Charts / Monthly / Daily tabs */}
        {campaign.daily_report_url ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className='flex items-center justify-between mb-4 gap-2 flex-wrap'>
              <TabsList className='rounded-xl h-9'>
                <TabsTrigger
                  value='daily'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  일간
                </TabsTrigger>
                <TabsTrigger
                  value='monthly'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  월간
                </TabsTrigger>
                <TabsTrigger
                  value='charts'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  차트
                </TabsTrigger>
              </TabsList>
              <div className='flex items-center gap-2'>
                {activeTab !== 'monthly' && (
                  <>
                    <DateRangePicker
                      value={dateRange}
                      onChange={setDateRange}
                      presets={datePickerPresets}
                      placeholder={
                        lastDate ? '최근 30일' : '기간 선택'
                      }
                      triggerClassName='max-[1100px]:justify-center'
                      hideLabelClassName='max-[1100px]:hidden'
                    />
                    <Button
                      variant={compareEnabled ? 'default' : 'outline'}
                      size='sm'
                      className='flex-shrink-0'
                      onClick={() => setCompareEnabled((v) => !v)}
                      title='다른 기간과 비교'
                    >
                      <span className='max-[1100px]:hidden'>
                        {compareEnabled ? '비교중' : '비교'}
                      </span>
                      <span className='hidden max-[1100px]:inline'>vs</span>
                    </Button>
                    {compareEnabled && (
                      <DateRangePicker
                        value={compareDateRange}
                        onChange={setCompareDateRange}
                        presets={datePickerPresets}
                        placeholder='비교 기간'
                        triggerClassName='max-[1100px]:justify-center'
                        hideLabelClassName='max-[1100px]:hidden'
                      />
                    )}
                  </>
                )}
                {activeTab === 'charts' && (
                  <Select
                    value={granularity}
                    onValueChange={(v) =>
                      setGranularity(v as 'daily' | 'weekly' | 'monthly')
                    }
                  >
                    <SelectTrigger className='h-9 w-auto gap-2 flex-shrink-0'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='daily'>일간</SelectItem>
                      <SelectItem value='weekly'>주간</SelectItem>
                      <SelectItem value='monthly'>월간</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  className='flex-shrink-0'
                  onClick={() => {
                    const url = campaign.daily_report_url!;
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className='h-4 w-4 max-[1100px]:mr-0 mr-2' />
                  <span className='max-[1100px]:hidden'>시트 보기</span>
                </Button>
                <Button
                  variant='default'
                  size='sm'
                  className='bg-black text-white hover:bg-black/90 flex-shrink-0'
                  onClick={() =>
                    fetchSheetData(campaign.daily_report_url!, true)
                  }
                  disabled={dataLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 max-[1100px]:mr-0 mr-2 ${
                      dataLoading ? 'animate-spin' : ''
                    }`}
                  />
                  <span className='max-[1100px]:hidden'>새로고침</span>
                </Button>
              </div>
            </div>

            {/* Period Comparison */}
            {compareEnabled && comparisonMetrics && activeTab !== 'monthly' && (
              <PeriodComparison
                current={comparisonMetrics.current}
                comparison={comparisonMetrics.comparison}
                currentRange={dateRange}
                comparisonRange={compareDateRange}
              />
            )}

            {/* Charts */}
            <TabsContent value='charts' className='space-y-4'>
              {dataLoading ? (
                <div className='space-y-4'>
                  <Skeleton className='h-[360px] w-full' />
                  <Skeleton className='h-[300px] w-full' />
                </div>
              ) : dataError ? (
                <div className='text-center py-8'>
                  <p className='text-destructive mb-2'>{dataError}</p>
                  <Button
                    variant='outline'
                    onClick={() =>
                      fetchSheetData(campaign.daily_report_url!, true)
                    }
                  >
                    다시 시도
                  </Button>
                </div>
              ) : !data || data.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  데이터가 없습니다.
                </div>
              ) : (
                <div className='space-y-4'>
                  <Card>
                    <CardHeader className='flex flex-row items-start justify-between gap-4 flex-wrap'>
                      <div>
                        <CardTitle>ROAS 추이</CardTitle>
                        <CardDescription>
                          {granularity === 'monthly'
                            ? '월간'
                            : granularity === 'weekly'
                            ? '주간'
                            : '일간'}{' '}
                          코호트별 ROAS. 빨간 점선 = 100% BEP.
                        </CardDescription>
                      </div>
                      <ToggleGroup
                        type='single'
                        size='sm'
                        variant='outline'
                        value={visibleCohort}
                        onValueChange={(v) => {
                          if (v) setVisibleCohort(v);
                        }}
                        className='flex-wrap justify-end'
                      >
                        {ROAS_COHORTS.map((c) => (
                          <ToggleGroupItem
                            key={c.key}
                            value={c.key}
                            className='h-8 px-3 text-xs'
                          >
                            <span
                              className='mr-1.5 inline-block h-2 w-2 rounded-full'
                              style={{ backgroundColor: c.color }}
                            />
                            {c.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={ROAS_CHART_CONFIG}
                        className='h-[320px] w-full'
                      >
                        <AreaChart
                          data={chartData}
                          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                        >
                          <defs>
                            {ROAS_COHORTS.map((c) => (
                              <linearGradient
                                key={c.key}
                                id={`fill-${c.key.replace(/\s+/g, '_')}`}
                                x1='0'
                                y1='0'
                                x2='0'
                                y2='1'
                              >
                                <stop
                                  offset='5%'
                                  stopColor={c.color}
                                  stopOpacity={0.45}
                                />
                                <stop
                                  offset='95%'
                                  stopColor={c.color}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray='3 3' />
                          <XAxis
                            dataKey='date'
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            tickFormatter={(v) => `${v}%`}
                            tickLine={false}
                            axisLine={false}
                            width={48}
                          />
                          <ChartTooltip
                            cursor={{
                              stroke: '#94a3b8',
                              strokeWidth: 1,
                              strokeDasharray: '4 4',
                            }}
                            content={(p) =>
                              renderTooltipWithNote(p, (v, name) => [
                                `${Number(v).toFixed(2)}%`,
                                ` ${String(name)}`,
                              ])
                            }
                          />
                          <ChartLegend content={<ChartLegendContent />} />
                          <ReferenceLine
                            y={100}
                            stroke='#ef4444'
                            strokeDasharray='5 5'
                            label={{
                              value: 'BEP 100%',
                              position: 'right',
                              fill: '#ef4444',
                              fontSize: 11,
                            }}
                          />
                          {ROAS_COHORTS.filter(
                            (c) => c.key === visibleCohort
                          ).map((c) => (
                            <Area
                              key={c.key}
                              type='monotone'
                              dataKey={c.key}
                              stroke={c.color}
                              strokeWidth={2.5}
                              fill={`url(#fill-${c.key.replace(
                                /\s+/g,
                                '_'
                              )})`}
                              fillOpacity={1}
                              dot={renderNoteDot}
                              activeDot={{ r: 4, strokeWidth: 0 }}
                              isAnimationActive={false}
                            />
                          ))}
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Volume Trend (Install / Cost / Revenue) */}
                  <Card>
                    <CardHeader className='flex flex-row items-start justify-between gap-4 flex-wrap'>
                      <div>
                        <CardTitle>볼륨 추이</CardTitle>
                        <CardDescription>
                          {granularity === 'monthly'
                            ? '월간'
                            : granularity === 'weekly'
                            ? '주간'
                            : '일간'}{' '}
                          지표별 볼륨
                        </CardDescription>
                      </div>
                      <ToggleGroup
                        type='single'
                        size='sm'
                        variant='outline'
                        value={visibleMetric}
                        onValueChange={(v) => {
                          if (v) setVisibleMetric(v);
                        }}
                        className='flex-wrap justify-end'
                      >
                        {VOLUME_METRICS.map((m) => (
                          <ToggleGroupItem
                            key={m.key}
                            value={m.key}
                            className='h-8 px-3 text-xs'
                          >
                            <span
                              className='mr-1.5 inline-block h-2 w-2 rounded-full'
                              style={{ backgroundColor: m.color }}
                            />
                            {m.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={VOLUME_CHART_CONFIG}
                        className='h-[280px] w-full'
                      >
                        <AreaChart
                          data={chartData}
                          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                        >
                          <defs>
                            {VOLUME_METRICS.map((m) => (
                              <linearGradient
                                key={m.key}
                                id={`vol-fill-${m.key}`}
                                x1='0'
                                y1='0'
                                x2='0'
                                y2='1'
                              >
                                <stop
                                  offset='5%'
                                  stopColor={m.color}
                                  stopOpacity={0.45}
                                />
                                <stop
                                  offset='95%'
                                  stopColor={m.color}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray='3 3'
                          />
                          <XAxis
                            dataKey='date'
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            tickFormatter={(v) =>
                              visibleMetric === 'Install'
                                ? `${v}`
                                : `$${v}`
                            }
                            tickLine={false}
                            axisLine={false}
                            width={56}
                          />
                          <ChartTooltip
                            cursor={{
                              stroke: '#94a3b8',
                              strokeWidth: 1,
                              strokeDasharray: '4 4',
                            }}
                            content={(p) =>
                              renderTooltipWithNote(p, (v, name) => [
                                visibleMetric === 'Install'
                                  ? Number(v).toLocaleString()
                                  : `$ ${Number(v).toFixed(2)}`,
                                ` ${String(name)}`,
                              ])
                            }
                          />
                          {VOLUME_METRICS.filter(
                            (m) => m.key === visibleMetric
                          ).map((m) => (
                            <Area
                              key={m.key}
                              type='monotone'
                              dataKey={m.key}
                              stroke={m.color}
                              strokeWidth={2.5}
                              fill={`url(#vol-fill-${m.key})`}
                              fillOpacity={1}
                              dot={renderNoteDot}
                              activeDot={{ r: 4, strokeWidth: 0 }}
                              isAnimationActive={false}
                            />
                          ))}
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Cost vs Revenue</CardTitle>
                      <CardDescription>
                        {granularity === 'monthly'
                          ? '월간'
                          : granularity === 'weekly'
                          ? '주간'
                          : '일간'}{' '}
                        Cost vs Revenue 비교
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={MONTHLY_CHART_CONFIG}
                        className='h-[280px] w-full'
                      >
                        <BarChart
                          data={chartData}
                          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray='3 3' />
                          <XAxis
                            dataKey='date'
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            tickFormatter={(v) => `$${v}`}
                            tickLine={false}
                            axisLine={false}
                            width={56}
                          />
                          <ChartTooltip
                            content={(p) =>
                              renderTooltipWithNote(p, (v, name) => [
                                `$ ${Number(v).toFixed(2)}`,
                                ` ${String(name)}`,
                              ])
                            }
                          />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar
                            dataKey='Cost'
                            fill='hsl(213 94% 78%)'
                            radius={4}
                          />
                          <Bar
                            dataKey='Revenue'
                            fill='hsl(221 83% 53%)'
                            radius={4}
                          />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Monthly Summary (전체 데이터 기준) */}
            <TabsContent value='monthly'>
              <MonthlySummaryTable rows={monthlySummary ?? []} />
            </TabsContent>

            {/* Daily Report Data */}
            <TabsContent value='daily'>
              <DailyReportTable
                loading={dataLoading}
                error={dataError}
                data={data ?? []}
                headers={headers}
                onRetry={() =>
                  fetchSheetData(campaign.daily_report_url!, true)
                }
              />
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className='pt-6'>
              <p className='text-center text-muted-foreground'>
                Report URL이 설정되지 않았습니다.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Edit Campaign Form */}
        {campaign && (
          <EditCampaignForm
            isOpen={showEditCampaignForm}
            onClose={() => {
              setShowEditCampaignForm(false);
            }}
            onUpdateCampaign={async (campaignId, campaignData) => {
              await handleUpdateCampaign(campaignId, campaignData);
            }}
            campaign={campaign}
            accountId={campaign.account_id}
            games={allGames.filter(
              (game) => game.account_id === campaign.account_id
            )}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
          }}
          onConfirm={handleDeleteCampaign}
          title={isManageAllowed ? '정말 삭제하시겠습니까?' : '캠페인을 삭제할 수 없습니다'}
          description={
            isManageAllowed
              ? `이 작업은 되돌릴 수 없습니다. ${campaign?.name} 캠페인이 영구적으로 삭제됩니다.`
              : `본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다. ${campaign?.name} 캠페인은 다른 사용자에게 할당된 광고주의 캠페인입니다.`
          }
          confirmLabel='삭제'
          cancelLabel='닫기'
          isAllowed={isManageAllowed}
        />
      </div>
    </AccessControl>
  );
}
