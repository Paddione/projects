#!/bin/bash
# Live thumbnail generation watcher
# Usage: ./scripts/live-thumbnail-watch.sh [directory] [--concurrency=8]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
API_BASE="${API_BASE:-https://videovault.korczewski.de}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse arguments
DIR_ARG=""
CONCURRENCY=8
WATCH_ONLY=false

for arg in "$@"; do
  case $arg in
    --concurrency=*)
      CONCURRENCY="${arg#*=}"
      ;;
    --watch)
      WATCH_ONLY=true
      ;;
    *)
      if [ -z "$DIR_ARG" ]; then
        DIR_ARG="$arg"
      fi
      ;;
  esac
done

# Functions
print_header() {
  clear
  echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║           VideoVault Live Thumbnail Generator                 ║${NC}"
  echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

get_stats() {
  curl -s "$API_BASE/api/jobs/stats/summary" 2>/dev/null || echo '{"pending":0,"processing":0,"completed":0,"failed":0,"active":0}'
}

get_recent_jobs() {
  curl -s "$API_BASE/api/jobs?status=processing,completed,failed&limit=10" 2>/dev/null || echo '{"jobs":[]}'
}

format_time() {
  local seconds=$1
  if [ "$seconds" -lt 60 ]; then
    echo "${seconds}s"
  elif [ "$seconds" -lt 3600 ]; then
    echo "$((seconds / 60))m $((seconds % 60))s"
  else
    echo "$((seconds / 3600))h $((seconds % 3600 / 60))m"
  fi
}

print_progress_bar() {
  local current=$1
  local total=$2
  local width=40

  if [ "$total" -eq 0 ]; then
    total=1
  fi

  local percent=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))

  printf "["
  printf "%${filled}s" | tr ' ' '█'
  printf "%${empty}s" | tr ' ' '░'
  printf "] %3d%% (%d/%d)" "$percent" "$current" "$total"
}

watch_queue() {
  local start_time=$(date +%s)
  local total_submitted=$1
  local last_completed=0

  while true; do
    print_header

    # Get stats
    local stats=$(get_stats)
    local pending=$(echo "$stats" | jq -r '.pending // 0')
    local processing=$(echo "$stats" | jq -r '.processing // 0')
    local completed=$(echo "$stats" | jq -r '.completed // 0')
    local failed=$(echo "$stats" | jq -r '.failed // 0')
    local active=$(echo "$stats" | jq -r '.active // 0')

    local elapsed=$(($(date +%s) - start_time))
    local total=$((pending + processing + completed + failed))

    if [ "$total_submitted" -gt 0 ]; then
      total=$total_submitted
    fi

    # Calculate rate
    local rate=0
    if [ "$elapsed" -gt 0 ] && [ "$completed" -gt 0 ]; then
      rate=$(echo "scale=2; $completed / $elapsed" | bc 2>/dev/null || echo "0")
    fi

    # Estimate remaining time
    local remaining_count=$((pending + processing))
    local eta="--"
    if [ "$rate" != "0" ] && [ "$remaining_count" -gt 0 ]; then
      local eta_seconds=$(echo "scale=0; $remaining_count / $rate" | bc 2>/dev/null || echo "0")
      if [ "$eta_seconds" -gt 0 ]; then
        eta=$(format_time "$eta_seconds")
      fi
    fi

    # Display stats
    echo -e "${BOLD}Queue Statistics:${NC}"
    echo -e "  ${YELLOW}⏳ Pending:${NC}    $pending"
    echo -e "  ${BLUE}⚙️  Processing:${NC} $processing (workers: $active)"
    echo -e "  ${GREEN}✅ Completed:${NC}  $completed"
    echo -e "  ${RED}❌ Failed:${NC}     $failed"
    echo ""

    # Progress bar
    echo -e "${BOLD}Overall Progress:${NC}"
    printf "  "
    print_progress_bar "$completed" "$total"
    echo ""
    echo ""

    # Time stats
    echo -e "${BOLD}Performance:${NC}"
    echo -e "  ⏱️  Elapsed:     $(format_time $elapsed)"
    echo -e "  🚀 Rate:        ${rate}/sec"
    echo -e "  ⏰ ETA:         $eta"
    echo ""

    # Recent jobs
    echo -e "${BOLD}Recent Activity:${NC}"
    local jobs=$(get_recent_jobs)
    echo "$jobs" | jq -r '.jobs[:5][] | "  \(.status | if . == "completed" then "✅" elif . == "failed" then "❌" elif . == "processing" then "⚙️ " else "⏳" end) \(.relativePath // .payload.inputPath // .id | split("/") | .[-1] // "unknown")[0:50]"' 2>/dev/null || echo "  (no recent activity)"
    echo ""

    # Exit condition
    if [ "$pending" -eq 0 ] && [ "$processing" -eq 0 ] && [ "$completed" -gt 0 ]; then
      echo -e "${GREEN}${BOLD}✨ All jobs completed!${NC}"
      break
    fi

    echo -e "${CYAN}Press Ctrl+C to exit${NC}"
    sleep 1
  done
}

submit_files() {
  local dir="$1"
  local count=0
  local submitted=0

  echo -e "${BOLD}Scanning directory: ${CYAN}$dir${NC}"
  echo ""

  # Find all video files
  while IFS= read -r -d '' file; do
    ((count++)) || true
    local filename=$(basename "$file")
    local relpath="${file#$dir/}"

    # Skip if file has no path
    if [ -z "$relpath" ]; then
      relpath="$filename"
    fi

    printf "\r  Submitting: %d files..." "$count"

    # Submit to API
    curl -s -X POST "$API_BASE/api/thumbnails/generate" \
      -H "Content-Type: application/json" \
      -d "{\"absolutePath\": \"$file\"}" > /dev/null 2>&1 && ((submitted++)) || true

  done < <(find "$dir" -type f \( -iname "*.mp4" -o -iname "*.mkv" -o -iname "*.avi" -o -iname "*.mov" -o -iname "*.webm" -o -iname "*.m4v" -o -iname "*.wmv" \) -print0 2>/dev/null)

  echo ""
  echo -e "${GREEN}✅ Submitted $submitted / $count files for processing${NC}"
  echo ""

  echo "$submitted"
}

# Main
if [ "$WATCH_ONLY" = true ]; then
  echo -e "${BOLD}Starting queue watcher...${NC}"
  watch_queue 0
elif [ -n "$DIR_ARG" ]; then
  if [ ! -d "$DIR_ARG" ]; then
    echo -e "${RED}Error: Directory not found: $DIR_ARG${NC}"
    exit 1
  fi

  submitted=$(submit_files "$DIR_ARG")
  watch_queue "$submitted"
else
  echo "Usage: $0 <directory> [--concurrency=N]"
  echo "       $0 --watch  (watch queue without submitting)"
  echo ""
  echo "Examples:"
  echo "  $0 /media/videos                 # Process all videos in directory"
  echo "  $0 /media/videos --concurrency=8 # Process with 8 workers"
  echo "  $0 --watch                       # Just watch the queue"
  exit 1
fi
