#!/usr/bin/env bash
set -e

# 1. Get the current Git commit short hash (or fallback if detached/no git)
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "DEV")
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "debug")

# 2. Define source and target paths
MAIN_RES_DIR="app/src/main/res"
DEBUG_RES_DIR="app/src/debug/res"

echo "🏷️  Badging debug launcher icons with Git SHA: $GIT_SHA ($BRANCH_NAME)..."

# Ensure ImageMagick is installed
if ! command -v convert &> /dev/null && ! command -v magick &> /dev/null; then
    echo "❌ Error: ImageMagick is not installed. Run 'brew install imagemagick' or 'sudo apt-get install imagemagick'."
    exit 1
fi

CMD="convert"
if command -v magick &> /dev/null; then
    CMD="magick"
fi

# 3. Process each density directory
for density_dir in "$MAIN_RES_DIR"/mipmap-*; do
    if [ -d "$density_dir" ]; then
        folder_name=$(basename "$density_dir")
        target_dir="$DEBUG_RES_DIR/$folder_name"
        mkdir -p "$target_dir"

        for icon in "$density_dir"/ic_launcher*.png; do
            if [ -f "$icon" ]; then
                icon_name=$(basename "$icon")
                target_icon="$target_dir/$icon_name"

                # Overlay a red banner at the bottom 30% of the icon with white text
                $CMD "$icon" \
                    \( -size 1x1 xc:"rgba(220, 38, 38, 0.88)" \) \
                    -geometry 100x30%! -gravity South -composite \
                    -fill white -gravity South -font Helvetica-Bold \
                    -pointsize 12 -annotate +0+2 "$GIT_SHA" \
                    "$target_icon"

                echo "  ✓ Badged: $target_icon"
            fi
        done
    fi
done

echo "✅ Debug icons successfully generated in $DEBUG_RES_DIR!"
