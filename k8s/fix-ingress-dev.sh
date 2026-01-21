#!/bin/bash
FILES=$(find services/ infrastructure/ -name "ingressroute*.yaml")
for FILE in $FILES; do
    echo "Processing $FILE"
    # Ensure both web and websecure entrypoints
    # First remove any existing entrypoints list to normalize
    sed -i '/entryPoints:/,/routes:/ { /routes:/!d }' "$FILE"
    sed -i '/entryPoints:/a \    - web\n    - websecure' "$FILE"
    
    # Comment out TLS section
    sed -i 's/tls:/# tls:/' "$FILE"
    sed -i 's/  secretName:/#   secretName:/' "$FILE"
done
