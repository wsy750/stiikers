# 전국 매출분석시스템 · 프록시 서버 배포 가이드

이 폴더는 화면(대시보드)이 실제 공공데이터를 불러올 수 있게 해주는 "중간 서버(프록시)"입니다.

## 0. 준비할 API 키 2개
① 카카오 REST API 키 (developers.kakao.com)
② 공공데이터포털 서비스키 (data.go.kr, 소상공인시장진흥공단 상가업소 API)

## 1. Vercel 배포
Vercel(vercel.com)에서 이 GitHub 저장소를 Import 하면 자동 배포됩니다.
Import 화면의 Environment Variables에 아래 두 개를 등록하세요.

- KAKAO_REST_API_KEY
- SEMAS_SERVICE_KEY

## 2. 실제 데이터로 되는 것 / 안 되는 것
- 업종 구성, 무인매장 분석 → 실제 공공데이터
- 시간대/연령대 유동인구, 예상 매출 → 추정 모델 (공공 API 미제공)
