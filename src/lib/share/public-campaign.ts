/**
 * 공개(비로그인) 캠페인 공유 페이지의 데이터 계약.
 * 서버(API route)와 클라이언트 양쪽에서 import 하므로 'use client' 를 두지 않는다.
 * 내부/민감 필드(daily_report_url, jira_url, 담당자, 토큰 등)는 여기에 포함하지 않는다.
 */

export interface PublicGame {
  game_name: string | null;
  logo_url: string | null;
  store_url: string | null;
  package_identifier: string | null;
}

export interface PublicCampaign {
  id: string;
  name: string;
  region: string | null;
  mmp: string | null;
  campaign_type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  /** 지역별 게임명 (스토어 표시용 공개 정보) */
  regional_game_name: string | null;
  game: PublicGame | null;
  account: { company: string | null } | null;
}

export const PUBLIC_CAMPAIGN_SELECT =
  'id, name, region, mmp, campaign_type, status, start_date, end_date, regional_game_name, game:games(game_name, logo_url, store_url, package_identifier), account:accounts(company)';
