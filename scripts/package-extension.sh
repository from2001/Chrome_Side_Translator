#!/bin/sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=$(node -p "JSON.parse(require('fs').readFileSync('$project_dir/manifest.json', 'utf8')).version")
output_dir="$project_dir/dist"
archive="$output_dir/side-translator-$version.zip"

runtime_files="
manifest.json
background.js
sidepanel.html
sidepanel.js
options.html
options.js
styles.css
lib/openai.js
lib/page-content.js
lib/result-format.js
assets/icons/icon-16.png
assets/icons/icon-32.png
assets/icons/icon-48.png
assets/icons/icon-128.png
"

mkdir -p "$output_dir"
rm -f "$archive"

cd "$project_dir"
for file in $runtime_files; do
  if [ ! -f "$file" ]; then
    printf 'Missing required extension file: %s\n' "$file" >&2
    exit 1
  fi
done

# Keep the archive limited to files required at runtime.
zip -q "$archive" $runtime_files
printf '%s\n' "$archive"
