# Supabase OAuth 설정 확인 가이드

## 🔍 **Supabase 대시보드에서 확인해야 할 설정들**

### 1. **프로젝트 기본 정보**
- **프로젝트 URL**: Supabase 대시보드에서 확인 (Settings > API)
- **Anon Key**: 환경 변수 `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 설정되어 있음
  - ⚠️ **절대 코드나 문서에 직접 작성하지 마세요!**

### 2. **Authentication > Settings**
다음 설정들을 확인하세요:

#### **Site URL**
- 현재 설정: `http://localhost:3000` (개발 환경)
- 프로덕션: `https://yourdomain.com`

#### **Redirect URLs**
다음 URL들이 추가되어 있는지 확인:
- `http://localhost:3000/auth/callback`
- `https://yourdomain.com/auth/callback` (프로덕션용)

### 3. **Authentication > Providers > Google**
다음 설정들을 확인하세요:

#### **Enable Google Provider**
- ✅ Google OAuth가 활성화되어 있는지 확인

#### **Client ID & Client Secret**
- Google Cloud Console에서 생성한 OAuth 2.0 클라이언트 ID와 시크릿이 올바르게 설정되어 있는지 확인

#### **Authorized redirect URIs (Google Cloud Console)**
Google Cloud Console에서 다음 URI들이 추가되어 있는지 확인:
- `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
  - ⚠️ `[YOUR_PROJECT_REF]`를 실제 Supabase 프로젝트 참조 ID로 교체하세요

### 4. **Database > Tables**
다음 테이블들이 존재하는지 확인:
- `user_profiles` 테이블
- 필요한 컬럼들 (user_id, email 등)

### 5. **API > Settings**
- **Row Level Security (RLS)** 설정 확인
- `user_profiles` 테이블에 적절한 RLS 정책이 설정되어 있는지 확인

## 🚨 **일반적인 문제들**

### **문제 1: Redirect URL 불일치**
- Supabase 대시보드의 Redirect URLs에 `http://localhost:3000/auth/callback`이 추가되어 있지 않음
- Google Cloud Console의 Authorized redirect URIs에 Supabase 콜백 URL이 추가되어 있지 않음

### **문제 2: Google OAuth 설정 누락**
- Google Cloud Console에서 OAuth 2.0 클라이언트 ID가 생성되지 않음
- Supabase에 Google OAuth 설정이 완료되지 않음

### **문제 3: 도메인 설정 문제**
- Site URL이 올바르게 설정되지 않음
- 개발 환경과 프로덕션 환경의 URL이 혼재

## 🔧 **해결 방법**

1. **Supabase 대시보드 접속**: https://supabase.com/dashboard
2. **프로젝트 선택**: 본인의 프로젝트 선택
3. **Authentication > Settings** 이동
4. **Site URL 확인**: `http://localhost:3000`
5. **Redirect URLs 확인**: `http://localhost:3000/auth/callback` 추가
6. **Authentication > Providers > Google** 이동
7. **Google OAuth 설정 확인**: Client ID, Client Secret 입력
8. **Google Cloud Console 확인**: Authorized redirect URIs에 Supabase 콜백 URL 추가

## 📝 **체크리스트**

- [ ] Supabase Site URL이 올바르게 설정됨
- [ ] Redirect URLs에 `/auth/callback` 경로가 추가됨
- [ ] Google OAuth Provider가 활성화됨
- [ ] Google Client ID와 Secret이 올바르게 설정됨
- [ ] Google Cloud Console에 Supabase 콜백 URL이 추가됨
- [ ] `user_profiles` 테이블이 존재함
- [ ] RLS 정책이 적절히 설정됨
