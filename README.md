# LifeSculpture

React와 Firebase로 구성된 개인 콘텐츠 웹 애플리케이션입니다. 게시글, 댓글, 공감, 이미지 업로드를 지원하며 Firebase Hosting에 배포합니다.

## 로컬 실행

Node.js 22 이상과 Firebase CLI가 필요합니다.

```bash
npm install
npm install --prefix frontend
npm install --prefix server
cp frontend/.env.example frontend/.env
cp server/.env.example server/.env
npm start
```

각 `.env` 파일의 빈 값을 본인의 Firebase 프로젝트와 Google OAuth 설정으로 채워야 합니다. Firebase 웹 구성값은 브라우저에서 사용하는 공개 식별자이지만, 허용 도메인과 API 제한은 Google Cloud Console에서 설정해 주세요.

## 서버 인증

서버는 저장소 안의 서비스 계정 JSON 파일을 읽지 않고 Application Default Credentials(ADC)를 사용합니다.

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="your-project-id"
npm run start-backend
```

배포 환경에서는 해당 런타임 서비스 계정에 필요한 최소 Firebase 권한만 부여해 주세요. 서비스 계정 개인 키 파일은 생성하거나 저장소에 추가하지 마세요.

## 검증

```bash
npm test
CI=true npm test --prefix frontend -- --runInBand
npm run build
```

Firebase 규칙 테스트는 Firestore 및 Storage 에뮬레이터를 사용합니다.

## 배포

```bash
npm run build
firebase deploy --only hosting,firestore:rules,storage
```

운영 프로젝트로 배포하기 전에 `.firebaserc`의 프로젝트 ID와 Firebase CLI 로그인 계정을 확인해 주세요.

## 보안

취약점은 공개 Issue 대신 GitHub의 비공개 보안 권고 기능으로 제보해 주세요. 자세한 내용은 [SECURITY.md](SECURITY.md)를 참고해 주세요.
