#!/usr/bin/env bash
# 全部的測試，一個跑完才跑下一個（很重：SwiftShader，一格 1–2 秒；全部大約 50 分鐘）
# 用法：cd src && ./run-tests.sh [測試名 ...]（沒給就全部）；記錄在 ../out/logs/<測試>.log，截圖在 ../out/<測試>/
# 先 build：node build-art.mjs --yaris && node make-free.mjs（試做頁）、node build-site.mjs <版號>（網站 docs/；app 測試用）
cd "$(dirname "$0")"
ALL="test-b1 test-b4 test-b3 neihu-test circuit-test drift-test crush-test mountain-test free-test test-app-b1 test-app-b4 site-test cloud-test online-test"
LIST="${*:-$ALL}"
mkdir -p ../out/logs
for t in $LIST; do
  case $t in
    test-app-b1|test-app-b4) args="../docs ../out/$t/app" ;;
    site-test) args="../docs ../out/$t/site" ;;
    online-test|cloud-test) args="../docs ../out/$t/${t%-test}" ;; # 試玩頁就給 ../docs/try
    free-test) args="" ;;
    *) args="../out/$t/$t" ;;
  esac
  start=$(date +%s)
  node "$t.mjs" $args > "../out/logs/$t.log" 2>&1
  code=$?
  oks=$(grep -c '^ *ok ' "../out/logs/$t.log")
  fails=$(grep -c '^ *FAIL ' "../out/logs/$t.log")
  echo "$t: exit $code, $oks ok, $fails FAIL, $(( $(date +%s) - start ))s — $(tail -1 "../out/logs/$t.log")"
done
