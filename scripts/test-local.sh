#!/usr/bin/env bash

set -euo pipefail

glob=$*
if [ "$glob" == "" ]; then
  glob="test/local/* test/remote/*"
fi

./scripts/gen_keys.js
./scripts/gen_vapid_keys.js
./scripts/check-i18n.js
./scripts/mocha-coverage.js -R dot $glob
grunt eslint copyright
