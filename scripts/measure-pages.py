"""Measure public Pages response bodies. No browser camera or user data is used."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import tempfile

origin = 'https://daiyanoa1234-eng.github.io/ai-3d-posture-coach/'
assets = json.loads(Path('ASSET-SIZES.json').read_text())

def measure(row):
    with tempfile.TemporaryDirectory() as tmp:
        headers = Path(tmp) / 'headers.txt'
        result = subprocess.run([
            'curl', '--silent', '--show-error', '--fail', '--compressed',
            '--header', 'Accept-Encoding: gzip', '--output', '/dev/null',
            '--dump-header', str(headers), '--write-out', '%{json}',
            origin + row['file'],
        ], capture_output=True, text=True, check=True)
        stats = json.loads(result.stdout)
        fields = {}
        for line in headers.read_text().splitlines():
            if ':' in line:
                key, value = line.split(':', 1)
                fields[key.lower()] = value.strip()
        return {
            'file': row['file'], 'status': stats['http_code'],
            'encodedResponseBodyBytes': int(stats['size_download']),
            'responseHeaderBytes': int(stats['size_header']),
            'contentEncoding': fields.get('content-encoding', 'identity'),
            'contentType': fields.get('content-type', ''),
        }

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    measured = list(pool.map(measure, assets['files']))
by_file = {row['file']: row for row in measured}
presets = [{
    'variant': p['variant'], 'model': p['model'],
    'encodedResponseBodyBytes': sum(by_file[f]['encodedResponseBodyBytes'] for f in p['files']),
    'responseHeaderBytes': sum(by_file[f]['responseHeaderBytes'] for f in p['files']),
} for p in assets['coldStartPresets']]
report = {
    'date': '2026-10-11', 'origin': origin, 'requestAcceptEncoding': 'gzip',
    'method': 'GET each hosted asset with curl, no browser cache',
    'files': measured, 'selectedFileTotals': presets,
    'limitations': 'Measured Pages HTTP response bodies, not a physical iPhone/Android session. Browser compression, HTTP/SW cache, duplicate fetches, TLS overhead and SW update checks affect actual wire usage. Use bench download output and browser Network for physical-device totals.',
}
Path('PAGES-TRANSFER.json').write_text(json.dumps(report, indent=2) + '\n')
rows = '\n'.join(f"| {r['file']} | {r['encodedResponseBodyBytes']} | {r['contentEncoding']} |" for r in measured)
totals = '\n'.join(f"| {p['variant']} / {p['model']} | {p['encodedResponseBodyBytes']} | {p['encodedResponseBodyBytes']/1e6:.3f} |" for p in presets)
Path('PAGES-TRANSFER.md').write_text(f'''# 公開Pagesでの転送量確認

2026-10-11。公開URLへのGET応答を取得し、圧縮されたHTTP本文のbytesを測定。Accept-Encoding: gzip、クライアントキャッシュなし。全ファイルHTTP 200。

| ファイル | HTTP本文bytes（圧縮後） | Content-Encoding |
| --- | ---: | --- |
{rows}

| 選択するファイル群 | HTTP本文bytes合計 | MB（10進） |
| --- | ---: | ---: |
{totals}

上記は公開サーバーの実測応答サイズを選択ファイルごとに合計した値です。**iPhone/Android実機のセッションを測定した値ではありません。** 通常のスマホはlite、PCはfull。SIMD対応環境はinternalを選択し、非SIMD環境ではnosimd_internal。現在のアプリはmodule variantを要求しません。

HTTPS/TLS・HTTPヘッダーは本文合計に含めません。HTTP/SWキャッシュ、同一ファイルの再取得、Service Worker更新チェック、ブラウザの圧縮交渉により回線上の実転送量は変化します。?bench=1のdownloadはこのページから観測可能な値であり、Service Worker内部の取得は全件見えません。実機の全転送量はSafari Web InspectorなどのNetworkで確認してください。
''')
print(json.dumps({'httpStatus': sorted(set(r['status'] for r in measured)), 'selectedFileTotals': presets}, indent=2))
