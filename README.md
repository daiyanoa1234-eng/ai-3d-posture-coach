# AI 3D Posture Coach

ブラウザ内でカメラ映像から33点の骨格を推定し、3Dマネキンに動きを反映する姿勢教育用デモです。医学的な診断・評価、安全性や腰部負荷の判定は行いません。

## 利用する

公開予定URL（未公開）: https://daiyanoa1234-eng.github.io/ai-3d-posture-coach/

1. 「カメラを起動」→説明に同意して開始します。カメラを使わない場合は「カメラなしでデモを見る」を選びます。デモの骨格・角度は合成値です。
2. 体の横をカメラに向け、頭から足先まで映します。カメラは腰の高さ（90〜100cm）、水平に、距離2.5〜3.5m。逆光・複雑な背景を避けます。
3. 「基準姿勢を補正」を押し、準備カウント3秒＋記録1.5秒の間、直立して静止します。信頼度不足・角度変動3°超では再試行を案内します。
4. 前屈／スクワット／持ち上げ模擬を切り替え、ゆっくり動きます。「終了」でカメラを停止します。

PCは左右、縦向きスマホは上下にカメラとモデルを表示します。3Dモデルはドラッグで回転、視点ボタンでも切替できます。音声は既定OFF、読み上げ間隔は最低5秒です。日本語の端末内音声（localService）のみ使用します。利用可能な音声がなければOFFのまま案内します。

## 構成と実装範囲

- Vite、TypeScript strict、Three.js（プリミティブマネキン）、MediaPipe Pose Landmarker VIDEOモード。
- 側面2D角度は実際の動画サイズでピクセル変換。見える側の肩・腰・脚を採用。正面は3Dワールド座標の**参考値**です。
- 2D・3D各軸のOne Euro Filter。GPU初期化失敗・推論例外はCPUへフォールバック。
- TRACKING/PARTIAL/LOST。低信頼の入力は即座に追従・フィードバックを止め、500msでLOST、約1秒で中立へ戻します。脚の信頼度不足では膝・股関節の数値を出しません。
- 基底合わせによる体幹分配（40/20/20/20%）、親空間FKによる下肢・簡易上肢、膝ヒンジ0〜150°、床高さの簡易補正。側面で奥側が隠れる場合は見える側を両脚へ複製します。
- 3モードの閾値・時間ヒステリシス、部位別色、数値・記号・ヒント。緑／橙／赤は姿勢変化のデモ用目安です。
- カメラ選択、前後切替、鏡表示、停止／再開。タブ非表示でカメラトラック・推論・描画を停止。
- `ModelLoader.ts` は任意GLBのボーン・マテリアル検査用アダプターです。GLBは未同梱・UIからの切替は未接続。Stage Aを使用します。
- GLBへの差替え、足の滑り、正面推定精度、iOS音声、上肢・鏡像の整合は実機で確認が必要です。

## 開発・検証

Node.js 22.12以降の22系または24系推奨（CIは22系）。

```sh
npm ci
npm run assets
npm run dev
npm run lint
npm test
npm run build
npm run preview
```

Viteのbaseは `/ai-3d-posture-coach/` 固定です。プレビューは `http://127.0.0.1:4174/ai-3d-posture-coach/`。別のリポジトリ名で配信する場合は `vite.config.ts` のbaseも変更します。スマホでのカメラ利用はHTTPSが必要です。LANのHTTPアドレスでは起動できません。

### 実機検証パラメータ

- `?bench=1`: カメラ起動後30秒間の平均推論FPS、描画FPS、推論ms、GPU/CPU、モデル、動画サイズ、UserAgent、品質調整の有無を表示。結果をクリップボードにコピーできます。推論FPSと描画FPSは別々に測定します。
- `?debug=1`: 上記に加え信頼度・軸符号、ボーン方向矢印、平滑化スライダーを表示。
- `?bench=1&model=lite&fps=12`: Phase 0の速度未達時の代替条件。FPSを下げた結果を元の15/25fps達成として扱わないでください。
- `?stable=1`: ワールド奥行きがぶれる場合のR3代替。体幹と下肢を2D角度から矢状面回転として合成。身体のねじれは再現しません。

スマホはlite・推論最大20fps、PCはfull・最大30fps。推論FPSが12未満で3秒続くとピクセル比1、最大15fps、GPU使用中ならCPUへ切替。低FPS時のCPU切替は機種によって改善しない場合があるため、`bench`の結果で判断してください。

## プライバシー・通信先

カメラ映像、ランドマーク、推定結果の送信・録画・ファイル保存は行いません。分析・広告・ログイン・DB・LLMは使用しません。姿勢結果はメモリ上のみ、直立基準値だけをカメラと動画サイズ別に `sessionStorage` に保持します（書込み失敗時はメモリのみ）。

| 通信先 | 用途 | タイミング |
| --- | --- | --- |
| `daiyanoa1234-eng.github.io` | HTML/JS/CSS、WASM、liteまたはfullモデル、Service Worker | 初回とアプリ更新時 |
| なし | カメラ映像・ランドマーク | 送信しない |

CSPで静的アセットを同一オリジンに限定。外部フォント・CDNなし。npmレジストリとGoogleのモデル配布先への接続は**開発／ビルド時のみ**です。カメラ拒否時はブラウザのサイト設定から許可して再試行してください。

## オフラインと容量

Production版にはService Workerを生成します。画面は初回訪問時、使用したモデル・WASMはカメラ起動時にキャッシュします。「オフライン準備完了」を確認してから機内モードにしてください。lite/fullを切替える場合は各モデルで一度オンライン起動が必要です。dev版にはService Workerを登録しません。更新はタブをすべて閉じてから再度開くと反映されます。ブラウザによるキャッシュ削除・容量制限により再読み込みが必要になる場合があります。

**NF-05（アセット合計15MB以下）は非圧縮サイズで未達です。** 公式配布物 `tasks-vision@1.1.0` のWASM約13MB＋lite約5.78MBまたはfull約9.40MB＋JS/CSS約0.71MBが初回カメラ起動に必要です。WASMはSIMD／非SIMD／moduleの各配布物を配置しますが、実行環境が選択したものだけを読み込みます。両モデルの事前一括ダウンロードはしません。実転送量はホストの圧縮に依存するため別途確認が必要です。小容量が必須の場合はlite固定や別の推定ライブラリを再検証してください。

モデルのSHA-256をビルド時に固定値と照合します。モデルの取得元・サイズ・SHA-256は `public/models/manifest.json`、固定されたバージョンは `package-lock.json` を参照してください。ビルドスクリプトは既存モデルを再利用します。

## 公開

公開リポジトリ作成は自動承認レビューにより未実施です。公開先 `daiyanoa1234-eng/ai-3d-posture-coach` とソース公開の承認後に作成・配信します。

新規リポジトリのSettings → Pages → Sourceを **GitHub Actions** にします。`main`へのpushでLint → Vitest → build → Pagesが実行されます。カメラ・解析データはGit管理対象にしません。詳しい受け入れ記録は `ACCEPTANCE.md` を参照してください。

## ライセンスと公式資料

- Three.js: MIT（`three@0.180.0`）。
- MediaPipe Tasks Vision: Apache-2.0（`@mediapipe/tasks-vision@1.1.0`）。
- マネキン: 本プロジェクトでプリミティブから生成。外部の人体モデル・写真・テクスチャは使用していません。
- Pose Landmarkerモデル: Google公式配布 `float16/1`。出典・SHA-256はmanifestに記録。
- [Google Pose Landmarker Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Google PoseLandmarker API](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.poselandmarker)
- [Three.js Quaternion documentation](https://threejs.org/docs/pages/Quaternion.html)

付属のREQUIREMENTS.mdが元の要件定義書です。この実装をMVP完了と判定する前に、ACCEPTANCE.mdの実機項目を確認してください。
