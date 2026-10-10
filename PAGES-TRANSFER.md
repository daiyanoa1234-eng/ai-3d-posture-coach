# 公開Pagesでの転送量確認

2026-10-11。公開URLへのGET応答を取得し、圧縮されたHTTP本文のbytesを測定。Accept-Encoding: gzip、クライアントキャッシュなし。全ファイルHTTP 200。

| ファイル | HTTP本文bytes（圧縮後） | Content-Encoding |
| --- | ---: | --- |
| assets/index-D0Qsqf8-.css | 3382 | gzip |
| assets/index-DgaPHLBp.js | 188953 | gzip |
| index.html | 565 | gzip |
| licenses/Apache-2.0.txt | 3329 | gzip |
| licenses/NOTICE.txt | 463 | gzip |
| licenses/three-MIT.txt | 662 | gzip |
| mediapipe/wasm/vision_wasm_internal.js | 82610 | gzip |
| mediapipe/wasm/vision_wasm_internal.wasm | 3892877 | gzip |
| mediapipe/wasm/vision_wasm_module_internal.js | 82557 | gzip |
| mediapipe/wasm/vision_wasm_module_internal.wasm | 3892884 | gzip |
| mediapipe/wasm/vision_wasm_nosimd_internal.js | 82545 | gzip |
| mediapipe/wasm/vision_wasm_nosimd_internal.wasm | 3775369 | gzip |
| models/manifest.json | 220 | gzip |
| models/pose_landmarker_full.task | 8356721 | gzip |
| models/pose_landmarker_lite.task | 4957076 | gzip |
| sw.js | 1067 | gzip |

| 選択するファイル群 | HTTP本文bytes合計 | MB（10進） |
| --- | ---: | ---: |
| internal / lite | 9130984 | 9.131 |
| internal / full | 12530629 | 12.531 |
| nosimd_internal / lite | 9013411 | 9.013 |
| nosimd_internal / full | 12413056 | 12.413 |
| module_internal / lite | 9130938 | 9.131 |
| module_internal / full | 12530583 | 12.531 |

上記は公開サーバーの実測応答サイズを選択ファイルごとに合計した値です。**iPhone/Android実機のセッションを測定した値ではありません。** 通常のスマホはlite、PCはfull。SIMD対応環境はinternalを選択し、非SIMD環境ではnosimd_internal。現在のアプリはmodule variantを要求しません。

HTTPS/TLS・HTTPヘッダーは本文合計に含めません。HTTP/SWキャッシュ、同一ファイルの再取得、Service Worker更新チェック、ブラウザの圧縮交渉により回線上の実転送量は変化します。?bench=1のdownloadはこのページから観測可能な値であり、Service Worker内部の取得は全件見えません。実機の全転送量はSafari Web InspectorなどのNetworkで確認してください。
