#!/usr/bin/env python3
import os
import sys
import requests
import time

# Get environment variables
API_KEY = os.environ.get('IPV64_API_KEY')
DOMAIN = os.environ.get('CERTBOT_DOMAIN')
VALIDATION = os.environ.get('CERTBOT_VALIDATION')

if not API_KEY:
    # Try to load from .env
    env_path = "/home/patrick/projects/.env"
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    if line.strip().startswith('IPV64_API_KEY='):
                        API_KEY = line.strip().split('=', 1)[1]
                        # Remove quotes if present
                        API_KEY = API_KEY.strip("'\"")
                        break
        except Exception as e:
            print(f"Error reading .env: {e}")

if not API_KEY:
    print("Error: IPV64_API_KEY not set and could not be found in .env")
    sys.exit(1)

# Certbot passes the domain. For wildcard "*.korczewski.de", it usually passes "korczewski.de".
# If it passes "*.korczewski.de", we need to strip it basically because add_record expects the domain.
# Also logic for ipv64:
# If you want to verify "*.korczewski.de", you add a TXT record for "_acme-challenge.korczewski.de".
# The API expects "add_record" = "korczewski.de" (the zone?) and "praefix" = "_acme-challenge".
# If I am verifying "korczewski.de", I add TXT for "_acme-challenge.korczewski.de".
# Note: ipv64 might treat "add_record" as the domain name to attach the record to.
# So if DOMAIN is "korczewski.de", we add to that.
# If DOMAIN is "*.korczewski.de", certbot might pass "korczewski.de" anyway as the validation domain. 
# But just in case:
if DOMAIN.startswith("*."):
    DOMAIN = DOMAIN[2:]

API_URL = "https://ipv64.net/api.php"

def add_record():
    print(f"Adding TXT record for {DOMAIN}...")
    # Based on API docs found:
    data = {
        'add_record': DOMAIN,
        'praefix': '_acme-challenge',
        'type': 'TXT',
        'content': VALIDATION
    }
    # Some APIs might need token in data or header. Search result said Bearer token in header.
    headers = {'Authorization': f'Bearer {API_KEY}'}
    
    try:
        resp = requests.post(API_URL, data=data, headers=headers)
        print(f"Response ({resp.status_code}): {resp.text}")
        
        if resp.status_code == 200 and ("info" in resp.text.lower() or "success" in resp.text.lower()):
            # Wait for propagation
            print("Waiting 15s for DNS propagation...")
            time.sleep(15)
        else:
            # If it failed, print why but maybe don't exit 1 specificially if we want to try anyway?
            # But unlikely to work.
            if "already exists" in resp.text.lower():
                print("Record might already exist, proceeding...")
            else:
                print("Failed to add record via API.")
                sys.exit(1)
    except Exception as e:
        print(f"Exception: {e}")
        sys.exit(1)

def delete_record():
    print(f"Deleting TXT record for {DOMAIN}...")
    data = {
        'del_record': DOMAIN,
        'praefix': '_acme-challenge',
        'type': 'TXT',
        'content': VALIDATION
    }
    headers = {'Authorization': f'Bearer {API_KEY}'}
    
    try:
        # Using DELETE method
        resp = requests.delete(API_URL, data=data, headers=headers)
        print(f"Response ({resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"Exception during cleanup: {e}")
        # Don't fail cleanup hard

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: ipv64_hook.py [auth|cleanup]")
        sys.exit(1)
    
    command = sys.argv[1]
    if command == "auth":
        add_record()
    elif command == "cleanup":
        delete_record()
    else:
        print("Unknown command")
        sys.exit(1)
