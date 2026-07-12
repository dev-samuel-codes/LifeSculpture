#!/usr/bin/env bash
set -euo pipefail

java_major_version() {
  java -version 2>&1 | awk -F '"' '/version/ {
    split($2, parts, ".");
    if (parts[1] == "1") {
      print parts[2];
    } else {
      print parts[1];
    }
  }'
}

if ! command -v java >/dev/null 2>&1 || [ "$(java_major_version)" -lt 21 ]; then
  if [ -x /opt/homebrew/opt/openjdk@21/bin/java ]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

if [ "$#" -gt 0 ]; then
  jest_command="./node_modules/.bin/jest $*"
else
  jest_command="./node_modules/.bin/jest tests/rules --runInBand"
fi

./node_modules/.bin/firebase emulators:exec --only firestore,storage "$jest_command"
