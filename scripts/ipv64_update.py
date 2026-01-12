#!/usr/bin/env python3
import os
import requests
import json
import socket
from pathlib import Path

# Configuration
PROJECT_ROOT = Path("/home/patrick/projects")
ENV_FILE = PROJECT_ROOT / ".env"
CACHE_FILE = PROJECT_ROOT / "scripts" / ".ipv64_ip_cache"

# IPv64 Update Configuration
API_URL = "https://ipv64.net/api.php"

def get_env_variable(var_name):
    """Simple helper to get variable from .env file without external deps."""
    if not ENV_FILE.exists():
        return None
    with open(ENV_FILE, "r") as f:
        for line in f:
            if line.strip().startswith(f"{var_name}="):
                val = line.strip().split("=", 1)[1]
                return val.strip("'\"")
    return None

def get_public_ip():
    """Fetches the current public IPv4 address."""
    services = [
        "https://checkip.amazonaws.com",
        "https://ifconfig.me/ip",
        "https://icanhazip.com"
    ]
    for service in services:
        try:
            response = requests.get(service, timeout=5)
            if response.status_code == 200:
                return response.text.strip()
        except:
            continue
    return None

def update_dyndns(api_key, ip):
    """Updates DynDNS records by first fetching tokens then using the update endpoint."""
    api_url = "https://ipv64.net/api.php"
    update_url = "https://ipv64.net/update.php"
    headers = {"Authorization": f"Bearer {api_key}"}
    
    try:
        # 1. Get all domains and their update hashes
        resp = requests.get(api_url + "?get_domains", headers=headers)
        if resp.status_code != 200:
            print(f"Failed to fetch domains: {resp.text}")
            return False
            
        domains_data = resp.json().get("subdomains", {})
        if not domains_data:
            print("No domains found in account.")
            return False
            
        success = True
        for domain, info in domains_data.items():
            token = info.get("domain_update_hash")
            if not token:
                continue
                
            print(f"Updating {domain}...")
            # 2. Use the Domain Update Hash on update.php (Standard DynDNS)
            upd_params = {"key": token, "ip": ip}
            upd_resp = requests.get(update_url, params=upd_params)
            
            content = upd_resp.text.lower()
            if "good" in content or "nochg" in content:
                print(f"  {domain} updated successfully: {upd_resp.text}")
            else:
                print(f"  {domain} update failed: {upd_resp.text}")
                success = False
        
        return success
            
    except Exception as e:
        print(f"Error during update process: {e}")
        return False

def get_dns_ip(domain):
    """Checks what the domain currently resolves to in public DNS."""
    try:
        return socket.gethostbyname(domain)
    except:
        return None

def main():
    api_key = get_env_variable("IPV64_API_KEY")
    if not api_key:
        print("Error: IPV64_API_KEY not found in .env")
        return

    current_ip = get_public_ip()
    if not current_ip:
        print("Error: Could not determine public IP")
        return

    # 1. Check what the internet thinks our IP is
    # We use korczewski.de for the check
    dns_ip = get_dns_ip("korczewski.de")
    
    # 2. Check cache to avoid unnecessary frequency
    last_known_local_ip = None
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r") as f:
            last_known_local_ip = f.read().strip()

    # Determine if we need to update
    needs_update = False
    reason = ""

    if current_ip != dns_ip:
        needs_update = True
        reason = f"DNS mismatch (Domain: {dns_ip}, Real: {current_ip})"
    elif current_ip != last_known_local_ip:
        needs_update = True
        reason = f"Local IP change (Old: {last_known_local_ip}, New: {current_ip})"

    if not needs_update:
        print(f"IP is correct ({current_ip}). DNS matches. Skipping update.")
        return

    print(f"Update required: {reason}. Updating IPv64...")
    if update_dyndns(api_key, current_ip):
        with open(CACHE_FILE, "w") as f:
            f.write(current_ip)
        print("Done.")
    else:
        print("Update failed.")

if __name__ == "__main__":
    main()
