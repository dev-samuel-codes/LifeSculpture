# LifeSculpture - 개인 웹사이트

개발 학습, 블로그, 일상 기록을 위한 개인 웹사이트입니다.

## 주요 기능

- **Study**: 개발 학습 내용 정리 및 관리
- **Blog**: 여행, 일상, 리뷰 등 다양한 콘텐츠
- **Admin Dashboard**: 콘텐츠 관리 및 사용자 관리
- **Google 로그인**: 사용자 인증 시스템

## 성능 최적화

### 이미지 지연 로딩 (Lazy Loading)
- Intersection Observer API를 사용한 효율적인 이미지 로딩
- 뷰포트에 보이기 전까지 이미지 로딩 지연
- 로딩 중 스켈레톤 애니메이션 제공
- 배경 이미지와 일반 이미지 모두 지원

#### 사용된 컴포넌트
- `LazyImage`: 일반 이미지 지연 로딩
- `LazyBackgroundImage`: 배경 이미지 지연 로딩
- `useLazyLoading`: 커스텀 훅

#### 설정 옵션
- `rootMargin`: 뷰포트 밖 50px 전에 미리 로딩
- `threshold`: 10% 보일 때 로딩 시작
- 로딩 실패 시 그레이스케일 처리

## Deployment Notes
- Deploy updated Firestore rules: firebase deploy --only firestore:rules
- Deploy composite indexes: firebase deploy --only firestore:indexes
- Monitor Firestore usage after launch and tune index TTL if needed.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
