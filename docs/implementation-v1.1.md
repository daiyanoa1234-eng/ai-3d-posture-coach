# v1.1変更報告

## 結果

- NF-05を「初回の転送量（gzip）15MB以下」に改定。ASSET-SIZES.mdの全プリセットが15,000,000 bytes以下で合格。公開応答実測はPAGES-TRANSFER.md。
- カメラ一覧を許可前と許可後に取得。deviceIdで切替、sessionStorageへ保存（アクセス不可でも利用可能）、切断済みカメラは既定入力へ復帰。PC・手動選択の外部カメラは非鏡像を既定。
- 黄 #ffd23f / △、赤 / ！をモデル右上と画面下部へ200msで表示。指定文言と常時注記を反映。
- 初回にアプリと選択モデル・WASMを準備。更新では既存の推論アセットを新バージョン用に取得後、旧キャッシュを削除して自動再読込。更新取得失敗なら旧版を維持。複数モデルを使った履歴がある場合、更新時は使用済みモデルを再取得するため初回より多い場合がある。

## 検証

- TypeScript strict / ESLint / production build: 成功。
- Vitest 29件 + Service Worker 2件: 成功。
- ブラウザ: カメラ許可なしのfullモデル準備完了、合成デモの黄赤表示・文言、200ms、375px幅の横はみ出し0、コンソールerror/warnなし（オンライン）を確認。
- Pages配信結果と転送量は公開後の記録を追記する。

## 手動確認

1. Macで内蔵カメラから連係iPhoneへ切替。許可後の実ラベル、非鏡像、タブ再読込後の選択復元、取り外したカメラの復帰を確認。
2. iPhone Safariで?bench=1を初回表示し「オフライン準備完了」を待つ。機内モード＋Wi-Fi OFF後、同URLを再起動しカメラ推論まで確認（NT-04）。サイトデータは削除しない。
3. 新版の配信時、画面の自動再読込・カメラ停止と旧バージョンキャッシュの削除を確認。回線断で更新失敗した際は旧版で再起動できること。
4. 実姿勢の黄赤遷移・鏡像整合・FPS、会場スクリーンで警告の可読性を確認。

## 変更ファイル

- docs/requirements.md（新規正本）、REQUIREMENTS.md（互換コピー）、AGENTS.md
- src/camera/Camera.ts、src/app/App.ts、src/feedback/feedbackConfig.ts
- src/ui/Hud.ts、src/ui/styles.css、src/offline/prepareOffline.ts（新規）
- scripts/prepare-sw.mjs、scripts/sw-template.mjs（新規）、scripts/test-sw.mjs（新規）
- tests/camera.test.ts（新規）、package.json
- scripts/report-assets.mjs、ASSET-SIZES.md、ASSET-SIZES.json
- README.md、ACCEPTANCE.md、docs/implementation-v1.1.md（本報告）
- PAGES-TRANSFER.md、PAGES-TRANSFER.json（公開後の応答サイズ再計測）
