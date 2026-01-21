#!/bin/bash
DOMAINS=("auth.korczewski.de" "l2p.korczewski.de" "payment.korczewski.de" "videovault.korczewski.de")
ENDPOINTS=("/api/health" "/api/health" "/api/health" "/api/health")

echo "Validating cluster services..."
for i in "${!DOMAINS[@]}"; do
    DOMAIN="${DOMAINS[$i]}"
    ENDPOINT="${ENDPOINTS[$i]}"
    echo -n "Testing $DOMAIN$ENDPOINT... "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN$ENDPOINT")
    if [ "$STATUS" == "200" ]; then
        echo -e "\033[0;32mOK (200)\033[0m"
    else
        echo -e "\033[0;31mFAILED ($STATUS)\033[0m"
        # Try without /api
        if [ "$STATUS" == "404" ]; then
            echo -n "  Retrying without /api... "
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/health")
            if [ "$STATUS" == "200" ]; then
                echo -e "\033[0;32mOK (200)\033[0m"
            else
                echo -e "\033[0;31mFAILED ($STATUS)\033[0m"
            fi
        fi
    fi
done
