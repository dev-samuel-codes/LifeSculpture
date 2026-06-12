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
  jest_args="$*"
else
  jest_args="tests/rules --runInBand"
fi

firebase emulators:exec --only firestore,storage "jest $jest_args"
