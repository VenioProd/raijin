"""Resolve the real client IP without trusting attacker-supplied headers.

Forwarded / X-Forwarded-For are spoofable when a request hits the application
directly. They are only meaningful when the immediate peer is a reverse proxy
we operate. This module reads the chain only when ``request.client.host``
falls inside ``settings.trusted_proxy_networks``; otherwise it returns the
direct peer.
"""
from __future__ import annotations

import ipaddress
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from fastapi import Request


def _peer_in_trusted_proxies(peer: str | None) -> bool:
    if not peer:
        return False
    try:
        addr = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return any(addr in network for network in get_settings().trusted_proxy_networks)


def _parse_forwarded_header(value: str) -> str | None:
    # RFC 7239: Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
    for token in value.split(","):
        for part in token.split(";"):
            part = part.strip()
            if part.lower().startswith("for="):
                ip = part[4:].strip().strip('"')
                # Strip IPv6 bracket notation `[2001:db8::1]:12345` and ports.
                if ip.startswith("["):
                    end = ip.find("]")
                    if end > 0:
                        return ip[1:end]
                return ip.split(":", 1)[0]
    return None


def get_client_ip(request: Request) -> str | None:
    """Return the real client IP, honoring forwarded headers only from proxies we trust."""
    peer = request.client.host if request.client else None
    if not _peer_in_trusted_proxies(peer):
        return peer

    forwarded = request.headers.get("forwarded")
    if forwarded:
        parsed = _parse_forwarded_header(forwarded)
        if parsed:
            return parsed

    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        # Leftmost address is the original client per de-facto convention,
        # populated by the trusted proxy. We already verified the peer is
        # one of our proxies, so it is safe to take the leftmost entry.
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    return peer
