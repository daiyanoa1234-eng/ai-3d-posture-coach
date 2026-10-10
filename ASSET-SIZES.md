# 配信アセット容量

単位はbytes、MBは10進数。最新buildの実ファイルを集計。NF-05「初回の転送量（gzip）15MB以下」は、選択プリセットすべて15,000,000 bytes以下で合格（下表）。公開ホストの実測はPAGES-TRANSFER.mdも参照。

| ファイル | 非圧縮bytes | ローカルgzip参考bytes |
| --- | ---: | ---: |
| assets/index-D0Qsqf8-.css | 10933 | 3344 |
| assets/index-DgaPHLBp.js | 696533 | 186979 |
| index.html | 972 | 565 |
| licenses/Apache-2.0.txt | 9141 | 3325 |
| licenses/NOTICE.txt | 768 | 463 |
| licenses/three-MIT.txt | 1081 | 662 |
| mediapipe/wasm/vision_wasm_internal.js | 335393 | 81443 |
| mediapipe/wasm/vision_wasm_internal.wasm | 12997248 | 3844009 |
| mediapipe/wasm/vision_wasm_module_internal.js | 335431 | 81382 |
| mediapipe/wasm/vision_wasm_module_internal.wasm | 12997272 | 3844012 |
| mediapipe/wasm/vision_wasm_nosimd_internal.js | 335196 | 81381 |
| mediapipe/wasm/vision_wasm_nosimd_internal.wasm | 12168316 | 3729309 |
| models/manifest.json | 358 | 220 |
| models/pose_landmarker_full.task | 9398198 | 8355592 |
| models/pose_landmarker_lite.task | 5777746 | 4956106 |
| sw.js | 2650 | 1066 |

配信する全ファイル合計: **55,067,236 (55.067 MB)**。このすべてを各端末が読み込むわけではありません。

| 実行条件 | 初回に選択される実ファイル合計 | ローカルgzip参考合計 |
| --- | ---: | ---: |
| internal / lite | 19,832,465 (19.832 MB) | 9,077,962 (9.078 MB) |
| internal / full | 23,452,917 (23.453 MB) | 12,477,448 (12.477 MB) |
| nosimd_internal / lite | 19,003,336 (19.003 MB) | 8,963,200 (8.963 MB) |
| nosimd_internal / full | 22,623,788 (22.624 MB) | 12,362,686 (12.363 MB) |
| module_internal / lite | 19,832,527 (19.833 MB) | 9,077,904 (9.078 MB) |
| module_internal / full | 23,452,979 (23.453 MB) | 12,477,390 (12.477 MB) |

通常のiPhone/Androidはlite、PCはfull。SIMD対応時はinternal、非対応時はnosimd_internal。現在のアプリはmodule variantを要求しませんが容量を参考記載。モデルの明示切替は?model=lite/full。

上記は**実際に選択されるファイルの非圧縮合計**で、通信回線の転送量実測ではありません。gzip値はローカル圧縮の参考値。GitHub PagesのContent-Encoding、HTTPキャッシュ、Service Worker制御タイミングによって実転送量は変わります。初回はService Workerが選択されたモデル/WASMを先に準備し、カメラ起動時は同じキャッシュを使います。画面の初回表示とシェル事前キャッシュはHTTPキャッシュで再利用されます。iPhoneの実測は?bench=1のdownload項目とWeb InspectorのNetworkで確認します。

再訪問ではキャッシュ済み本文の転送は0 bytesになる場合がありますが、Service Worker更新確認などの通信が残る可能性があります。モデルmanifestはアプリから読み込まず、上記初回合計に含めません。
