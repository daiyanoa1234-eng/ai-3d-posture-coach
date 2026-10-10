# 配信アセット容量

単位はbytes、MBは10進数。最新buildの実ファイルを集計。

| ファイル | 非圧縮bytes | ローカルgzip参考bytes |
| --- | ---: | ---: |
| assets/index-C8K5n1jO.js | 694824 | 186405 |
| assets/index-DqOJSIuA.css | 10245 | 3181 |
| index.html | 972 | 568 |
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
| sw.js | 954 | 519 |

配信する全ファイル合計: **55,063,143 (55.063 MB)**。このすべてを各端末が読み込むわけではありません。

| 実行条件 | 初回に選択される実ファイル合計 | ローカルgzip参考合計 |
| --- | ---: | ---: |
| internal / lite | 19,828,372 (19.828 MB) | 9,076,681 (9.077 MB) |
| internal / full | 23,448,824 (23.449 MB) | 12,476,167 (12.476 MB) |
| nosimd_internal / lite | 18,999,243 (18.999 MB) | 8,961,919 (8.962 MB) |
| nosimd_internal / full | 22,619,695 (22.620 MB) | 12,361,405 (12.361 MB) |
| module_internal / lite | 19,828,434 (19.828 MB) | 9,076,623 (9.077 MB) |
| module_internal / full | 23,448,886 (23.449 MB) | 12,476,109 (12.476 MB) |

通常のiPhone/Androidはlite、PCはfull。SIMD対応時はinternal、非対応時はnosimd_internal。現在のアプリはmodule variantを要求しませんが容量を参考記載。モデルの明示切替は?model=lite/full。

上記は**実際に選択されるファイルの非圧縮合計**で、通信回線の転送量実測ではありません。gzip値はローカル圧縮の参考値。GitHub PagesのContent-Encoding、HTTPキャッシュ、Service Worker制御タイミングによって実転送量は変わります。モデル/WASMのキャッシュ準備中にHTTPキャッシュが再利用されないと追加の転送が生じます。iPhoneの実測は?bench=1のdownload項目とWeb InspectorのNetworkで確認します。

再訪問ではキャッシュ済み本文の転送は0 bytesになる場合がありますが、Service Worker更新確認などの通信が残る可能性があります。モデルmanifestはアプリから読み込まず、上記初回合計に含めません。
