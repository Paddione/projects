#!/bin/bash

# Configuration
PROJECTS=("l2p" "auth" "VideoVault" "shop" "arena")
project_scripts=("npm run typecheck" "npm run typecheck" "npm run check" "npm run typecheck" "npm run typecheck")

status=0
failures=()

echo "Starting typecheck for all projects..."

for i in "${!PROJECTS[@]}"; do
    project="${PROJECTS[$i]}"
    script="${project_scripts[$i]}"
    
    echo "----------------------------------------"
    echo "Checking $project..."
    echo "----------------------------------------"
    
    if (cd "$project" && $script); then
        echo "✅ $project passed"
    else
        echo "❌ $project failed"
        status=1
        failures+=("$project")
    fi
done

echo "----------------------------------------"
if [ ${#failures[@]} -gt 0 ]; then
    echo "Summary: failures in [ ${failures[*]} ]"
else
    echo "Summary: all projects passed! 🎉"
fi

exit $status
