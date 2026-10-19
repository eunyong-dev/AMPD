import { redirect } from 'next/navigation';

/**
 * 홈(대시보드) 화면은 쓰지 않는다. 루트로 들어오면 캠페인 현황으로 보낸다.
 */
export default function RootPage() {
  redirect('/campaigns');
}
